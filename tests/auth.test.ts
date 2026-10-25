import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { can } from "../lib/rbac";

test("password hashes use unique salts and verify only the correct password", async () => {
  const first = await hashPassword("A long password!123");
  assert.notEqual(first, await hashPassword("A long password!123"));
  assert.equal(await verifyPassword("A long password!123", first), true);
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword("anything", "bad hash"), false);
});

test("existing sample-user scrypt passwords remain compatible", async () => {
  const salt = "a".repeat(32);
  const legacy = `scrypt$${salt}$${scryptSync("flawment123", salt, 32).toString("hex")}`;
  assert.equal(await verifyPassword("flawment123", legacy), true);
});

test("roles enforce project boundaries and reserve permissions for future tasks", () => {
  assert.equal(can(null, "project:read"), false);
  assert.equal(can("PARTICIPANT", "project:read"), true);
  assert.equal(can("PARTICIPANT", "members:manage"), false);
  assert.equal(can("PARTICIPANT", "project:delete"), false);
  assert.equal(can("MANAGER", "project:update"), true);
  assert.equal(can("MANAGER", "tasks:manage"), true);
  assert.equal(can("MANAGER", "members:roles"), false);
  assert.equal(can("MANAGER", "project:delete"), false);
  assert.equal(can("ADMIN", "project:delete"), true);
  assert.equal(can(null, "project:delete", "SUPER_ADMIN"), true);
});
