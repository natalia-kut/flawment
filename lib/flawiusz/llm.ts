// Minimal streaming client for OpenAI-compatible chat endpoints (LM Studio, Ollama, OpenRouter).

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

export type LlmConfig = { baseUrl: string; model: string; apiKey?: string };

export function llmConfig(): LlmConfig | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const model = process.env.LLM_MODEL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim() || undefined;
  return baseUrl && model ? { baseUrl: baseUrl.replace(/\/+$/, ""), model, apiKey } : null;
}

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
    headers: {
      "content-type": "application/json",
      ...(config.apiKey && { authorization: `Bearer ${config.apiKey}` }),
    },
    // Some servers reject an empty tools list, so leave it out instead.
    body: JSON.stringify({ model: config.model, messages, tools: tools.length > 0 ? tools : undefined, stream: true }),
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

      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        // Skip anything that isn't a chunk (keep-alives, partial or malformed lines).
        continue;
      }
      const delta = chunk.choices?.[0]?.delta;
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
