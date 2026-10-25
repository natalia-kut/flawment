import { currentUser } from "@/lib/auth/session";
import { runFlawiusz, type AgentEvent, type ConversationMessage } from "@/lib/flawiusz/agent";
import { unavailableMessage } from "@/lib/flawiusz/phrases";

// Streams Flawiusz's reply as newline-delimited JSON events (see AgentEvent).

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
  // Checked before the model is called, so signed-out requests cost nothing.
  if (!(await currentUser())) return Response.json({ error: "Sign in to use Flawiusz." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const conversation = parseConversation(body);
  if (!conversation) return Response.json({ error: "Invalid conversation." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        if (!request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runFlawiusz(conversation, emit, request.signal);
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("Flawiusz failed", error);
          emit({ type: "error", message: unavailableMessage });
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
