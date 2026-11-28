import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { changePassword } from "../../lib/auth/service";
import { hashPassword, verifyPassword } from "../../lib/auth/password";
import { endOtherSessions } from "../../lib/auth/session";

const errorOf = (result: { error: string } | { ok: true }) => "error" in result ? result.error : "";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("a password changes only with the current one, and other sessions can be ended", async () => {
  const prefix = "pw-test-" + randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: {
    username: prefix, email: prefix + "@example.test", password: await hashPassword("old password 1"), first_name: "Test", last_name: "Password",
  } });
  try {
    const change = (current: string, next: string, confirm = next) =>
      changePassword(user.id, form({ current_password: current, new_password: next, confirm_password: confirm }));
    assert.deepEqual(await change("wrong password", "new password 2"), { error: "Your current password is not correct." });
    assert.match(errorOf(await change("old password 1", "short")), /between 10 and 128/);
    assert.match(errorOf(await change("old password 1", "new password 2", "other password 3")), /do not match/);
    assert.match(errorOf(await change("old password 1", "old password 1")), /differs/);
    assert.deepEqual(await change("old password 1", "new password 2"), { ok: true });
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(await verifyPassword("new password 2", saved.password), true);
    assert.equal(await verifyPassword("old password 1", saved.password), false);

    const expires_at = new Date(Date.now() + 3_600_000);
    await prisma.session.createMany({ data: ["a", "b", "c"].map((name) => ({ token_hash: prefix + name, user_id: user.id, expires_at })) });
    assert.equal(await endOtherSessions(user.id, prefix + "a"), 2);
    assert.deepEqual((await prisma.session.findMany({ where: { user_id: user.id } })).map((s) => s.token_hash), [prefix + "a"]);

    // Guessing the current password from an open session is limited like logging in.
    for (let i = 0; i < 10; i++) await change("guess " + i + " xxxxx", "another password 4");
    assert.match(errorOf(await change("new password 2", "another password 4")), /Too many attempts/);
  } finally {
    await prisma.loginAttempt.deleteMany({ where: { key: createHash("sha256").update("password-change:" + user.id).digest("hex") } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
