// Minimal streaming client for OpenAI-compatible chat endpoints, such as the one
// LM Studio serves at http://host:1234/v1. Configured with LLM_BASE_URL and LLM_MODEL in .env.

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

export type LlmConfig = { baseUrl: string; model: string };

export function llmConfig(): LlmConfig | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const model = process.env.LLM_MODEL?.trim();
  return baseUrl && model ? { baseUrl: baseUrl.replace(/\/+$/, ""), model } : null;
}

// Qwen3's switch for skipping its reasoning, used unless the user turns thinking on
// in the chat (on a CPU, thinking roughly triples the response time). Other models ignore it.
export const noThinkSwitch = " /no_think";

type StreamChunk = {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

// Some models write their reasoning inline as <think>…</think>; hide it, and hold
// back a half-received "<think" so it never flashes in the chat.
function visibleText(content: string) {
  return content
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, "")
    .replace(/<\/?t?h?i?n?k?$/, "")
    .trimStart();
}

export async function streamCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  tools: ToolSpec[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: config.model, messages, tools, stream: true }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Model server responded with ${response.status}: ${await response.text().catch(() => "")}`);
  }

  let content = "";
  let emitted = "";
  const calls: { id: string; name: string; arguments: string }[] = [];

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const data = line.trim();
      if (!data.startsWith("data:")) continue;
      const payload = data.slice(5).trim();
      if (payload === "[DONE]") continue;

      const delta = (JSON.parse(payload) as StreamChunk).choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        content += delta.content;
        const visible = visibleText(content);
        if (visible.startsWith(emitted) && visible.length > emitted.length) {
          onText(visible.slice(emitted.length));
          emitted = visible;
        }
      }

      for (const part of delta.tool_calls ?? []) {
        const call = (calls[part.index ?? 0] ??= { id: "", name: "", arguments: "" });
        if (part.id) call.id = part.id;
        if (part.function?.name) call.name += part.function.name;
        if (part.function?.arguments) call.arguments += part.function.arguments;
      }
    }
  }

  return {
    content: visibleText(content),
    toolCalls: calls
      .filter((call) => call.name)
      .map((call, index) => ({
        id: call.id || `call_${index}`,
        type: "function",
        function: { name: call.name, arguments: call.arguments || "{}" },
      })),
  };
}
