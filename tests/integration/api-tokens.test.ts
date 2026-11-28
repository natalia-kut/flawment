import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth/password";
import { MAX_TOKENS } from "../../lib/auth/api-token-limits";
import {
  ApiTokenError, bearerToken, createApiToken, deleteAllApiTokens, deleteApiToken, listApiTokens, userFromToken,
} from "../../lib/auth/api-tokens";
import { listProjects } from "../../lib/flawiusz/tools/projects";

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of [value].flat()) data.append(key, item);
  }
  return data;
}

const tokenForm = (overrides: Record<string, string | string[]> = {}) =>
  form({ name: "Claude", scopes: ["MCP_READ"], days: "30", ...overrides });

async function rejects(call: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(call, (error) => error instanceof ApiTokenError && pattern.test(error.message));
}

test("an access token acts as its owner, only for its scopes, until it expires or is revoked", async () => {
  const prefix = "token-test-" + randomUUID().slice(0, 8);
  const password = await hashPassword("a password 123");
  const [owner, other] = await Promise.all(["a", "b"].map((name) => prisma.user.create({ data: {
    username: prefix + name, email: `${prefix}${name}@example.test`, password, first_name: "Test", last_name: "Token",
  } })));
  const project = await prisma.project.create({ data: {
    name: prefix, start_date: new Date("2026-01-01"), owner_id: owner.id, memberships: { create: { user_id: owner.id, role: "OWNER" } },
  } });
  try {
    await rejects(createApiToken(owner.id, tokenForm({ name: "  " })), /name/);
    await rejects(createApiToken(owner.id, tokenForm({ scopes: [] })), /used for/);
    await rejects(createApiToken(owner.id, tokenForm({ scopes: ["SUPER_ADMIN"] })), /used for/);
    await rejects(createApiToken(owner.id, tokenForm({ days: "10000" })), /expires/);

    const now = new Date();
    const { id, token } = await createApiToken(owner.id, tokenForm({ scopes: ["MCP_READ", "MCP_READ"] }), now);
    assert.match(token, /^flw_[a-f0-9]{64}$/);
    // Only a hash and a short prefix are kept.
    const saved = await prisma.apiToken.findUniqueOrThrow({ where: { id } });
    assert.notEqual(saved.token_hash, token);
    assert.equal(token.startsWith(saved.prefix), true);
    assert.deepEqual(saved.scopes, ["MCP_READ"]);
    assert.equal(saved.expires_at.getTime(), now.getTime() + 30 * 86_400_000);

    const actor = await userFromToken(token, "MCP_READ", now);
    assert.equal(actor?.id, owner.id);
    assert.equal((await prisma.apiToken.findUniqueOrThrow({ where: { id } })).last_used_at?.getTime(), now.getTime());
    assert.equal(await userFromToken(token, "CALENDAR", now), null, "a scope the token lacks");
    assert.equal(await userFromToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"), "MCP_READ", now), null, "an unknown token");
    assert.equal(await userFromToken("not a token", "MCP_READ", now), null);
    assert.equal(await userFromToken(token, "MCP_READ", new Date(saved.expires_at.getTime())), null, "an expired token");

    // The same tools as Flawiusz, with the person from the token instead of a cookie.
    assert.deepEqual(await listProjects.run({}, { actor: actor!, chosenProjectId: undefined }), { ok: true, value: [{ id: project.id, name: project.name }] });
    assert.deepEqual(await listProjects.run({}, { chosenProjectId: undefined }), { ok: false, error: "Sign in first." });

    await prisma.user.update({ where: { id: owner.id }, data: { is_active: false } });
    assert.equal(await userFromToken(token, "MCP_READ", now), null, "a deactivated account");
    await prisma.user.update({ where: { id: owner.id }, data: { is_active: true } });

    assert.equal(await deleteApiToken(other.id, id), false, "someone else's token");
    assert.equal(await deleteApiToken(owner.id, id), true);
    assert.equal(await userFromToken(token, "MCP_READ", now), null, "a revoked token");

    // At most MAX_TOKENS each, even when created at once.
    const created = await Promise.allSettled(Array.from({ length: MAX_TOKENS + 2 }, () => createApiToken(owner.id, tokenForm())));
    assert.equal(created.filter((result) => result.status === "fulfilled").length, MAX_TOKENS);
    assert.equal((await listApiTokens(owner.id)).length, MAX_TOKENS);
    assert.equal(await deleteAllApiTokens(owner.id), MAX_TOKENS);
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    await prisma.$disconnect();
  }
});

test("a bearer token is read from the Authorization header", () => {
  const request = (value?: string) => new Request("http://localhost/api/mcp", value ? { headers: { authorization: value } } : {});
  assert.equal(bearerToken(request("Bearer flw_abc")), "flw_abc");
  assert.equal(bearerToken(request("bearer   flw_abc")), "flw_abc");
  assert.equal(bearerToken(request("Basic flw_abc")), null);
  assert.equal(bearerToken(request("Bearer two words")), null);
  assert.equal(bearerToken(request()), null);
});
