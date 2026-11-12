import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { can } from "../lib/rbac";
import { isValidName } from "../lib/auth/names";

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

test("project roles: owners decide, coordinators run the work, contributors add and do their own", () => {
  assert.equal(can(null, "project:read"), false);
  assert.equal(can("CONTRIBUTOR", "project:read"), true);
  assert.equal(can("CONTRIBUTOR", "tasks:create"), true, "anyone on a project may add tasks");
  assert.equal(can("CONTRIBUTOR", "tasks:own"), true);
  assert.equal(can("CONTRIBUTOR", "tasks:manage"), false);
  assert.equal(can("CONTRIBUTOR", "members:manage"), false);
  assert.equal(can("CONTRIBUTOR", "project:delete"), false);
  assert.equal(can("COORDINATOR", "project:update"), true);
  assert.equal(can("COORDINATOR", "tasks:manage"), true);
  assert.equal(can("COORDINATOR", "members:manage"), true);
  assert.equal(can("COORDINATOR", "members:roles"), false);
  assert.equal(can("COORDINATOR", "project:delete"), false);
  assert.equal(can("OWNER", "members:roles"), true);
  assert.equal(can("OWNER", "project:delete"), true);
  assert.equal(can(null, "project:delete", "SUPER_ADMIN"), true);
});

test("names allow letters from any alphabet joined by a hyphen, apostrophe or space, and nothing else", () => {
  for (const name of ["Anna", "Łucja", "José", "Zoë", "Nowak-Kowalska", "O'Brien", "D’Angelo", "Anna Maria", "van der Berg"]) {
    assert.equal(isValidName(name), true, name);
  }
  for (const name of ["22", "Anna2", "Anna--Maria", "-Anna", "Anna-", "Anna  Maria", "Anna!", "x".repeat(81)]) {
    assert.equal(isValidName(name), false, name);
  }
});
