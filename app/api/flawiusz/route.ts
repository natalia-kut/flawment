import { runFlawiusz, type AgentEvent, type ConversationMessage } from "@/lib/flawiusz/agent";

// Streams Flawiusz's reply as newline-delimited JSON events (see AgentEvent).
// TODO(auth): Require a signed-in user.

const limits = { messages: 40, characters: 4000 };

function parseConversation(body: unknown): ConversationMessage[] | null {
  if (typeof body !== "object" || body === null || !Array.isArray((body as { messages?: unknown }).messages)) {
    return null;
  }
  const messages = (body as { messages: unknown[] }).messages.slice(-limits.messages);
  const conversation: ConversationMessage[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) return null;
    const { role, content } = message as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    conversation.push({ role, content: content.slice(0, limits.characters) });
  }
  return conversation.at(-1)?.role === "user" ? conversation : null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const conversation = parseConversation(body);
  if (!conversation) return Response.json({ error: "Invalid conversation." }, { status: 400 });
  const thinking = (body as { thinking?: unknown }).thinking === true;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        if (!request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runFlawiusz(conversation, thinking, emit, request.signal);
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("Flawiusz failed", error);
          emit({
            type: "error",
            message: "Flawiusz can't reach the model server. Check that LM Studio is running.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
