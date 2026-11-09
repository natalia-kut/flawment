import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { runFlawiusz, type AgentEvent } from "../lib/flawiusz/agent";
import { stuckMessage } from "../lib/flawiusz/phrases";

type Delta = { content?: string; reasoning?: string; tool_calls?: unknown[] };
type RequestBody = { messages: { role: string; content: string; reasoning?: string }[]; tools: unknown[] };

const realFetch = globalThis.fetch;
let requests: RequestBody[];

function stubModel(next: (request: number) => Delta[]) {
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)) as RequestBody);
    const lines = next(requests.length - 1).map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n`);
    return new Response(`${lines.join("")}data: [DONE]\n`);
  }) as typeof fetch;
}

function dateCall(args = "{}") {
  return { index: 0, id: "call_1", function: { name: "get_current_date", arguments: args } };
}

async function run() {
  const events: AgentEvent[] = [];
  await runFlawiusz(
    [{ role: "user", content: "Hi" }],
    (event) => events.push(event),
    new AbortController().signal,
    { chosenProjectId: undefined },
  );
  return events;
}

beforeEach(() => {
  requests = [];
  process.env.LLM_BASE_URL = "http://model.test";
  process.env.LLM_MODEL = "test";
  process.env.LLM_API_KEY = "test";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("sends reasoning back on tool-call turns and streams only the content", async () => {
  stubModel((request) =>
    request === 0
      ? [{ reasoning: "I need the date." }, { tool_calls: [dateCall()] }]
      : [{ reasoning: "Now answer." }, { content: "Done" }],
  );

  const events = await run();

  const assistant = requests[1].messages.find((message) => message.role === "assistant");
  assert.equal(assistant?.reasoning, "I need the date.");
  const text = events.flatMap((event) => (event.type === "text" ? [event.text] : []));
  assert.deepEqual(text, ["Done"]);
});

test("keeps the prompt prefix identical and does not limit steps", async () => {
  const steps = 30;
  stubModel((request) =>
    request < steps ? [{ tool_calls: [dateCall(JSON.stringify({ step: request }))] }] : [{ content: "Done" }],
  );

  const events = await run();

  assert.equal(requests.length, steps + 1);
  for (const request of requests) {
    assert.deepEqual(request.tools, requests[0].tools);
    assert.deepEqual(request.messages[0], requests[0].messages[0]);
  }
  assert.ok(!events.some((event) => event.type === "error"));
});

test("stops when the model keeps repeating the same tool call", async () => {
  stubModel(() => [{ tool_calls: [dateCall()] }]);

  const events = await run();

  assert.equal(requests.length, 4);
  assert.deepEqual(events.at(-1), { type: "error", message: stuckMessage });
});
