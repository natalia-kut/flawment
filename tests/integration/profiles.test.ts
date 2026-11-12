import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../../lib/prisma";
import { updateProfile, profileVisibility } from "../../lib/profiles/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("profiles respect account and project boundaries", async () => {
  const prefix = "profile-" + randomUUID();
  const users: number[] = [], projects: number[] = [];
  try {
    for (const suffix of ["owner", "manager", "member", "outsider", "root"]) {
      const user = await prisma.user.create({ data: { username: prefix + suffix, email: `${prefix}${suffix}@example.test`, password: "test-unused", first_name: "Test", last_name: suffix, role: suffix === "root" ? "SUPER_ADMIN" : "USER" } });
      users.push(user.id);
    }
    const actor = (index: number) => ({ id: users[index], role: index === 4 ? "SUPER_ADMIN" as const : "USER" as const });
    for (const name of ["one", "two"]) {
      const project = await prisma.project.create({ data: { name: prefix + name, start_date: new Date(), owner_id: users[0], memberships: { create: [
        { user_id: users[0], role: "ADMIN" }, { user_id: users[1], role: "MANAGER" }, { user_id: users[2], role: "PARTICIPANT" },
      ] } } });
      projects.push(project.id);
    }
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).png().toBuffer();
    const update = form({ user_id: users[1], role: "SUPER_ADMIN" });
    update.set("photo", new File([new Uint8Array(png)], "photo.png", { type: "image/png" }));
    await updateProfile(actor(0), update);
    let profile = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
    assert.equal(profile.role, "USER");
    assert.ok(profile.photo && profile.photo_updated_at);
    assert.equal((await sharp(profile.photo).metadata()).format, "webp");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[1] } })).photo, null, "only your own photo changes");
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(2), users[0]) }), 1);
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(3), users[0]) }), 1, "the company directory is open to every user");
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(0), users[4]) }), 0);
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(4), users[0]) }), 1);
    await assert.rejects(updateProfile(actor(0), form({})), /Choose a photo/);
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).photo, "a failed save keeps the photo");
    await updateProfile(actor(0), form({ remove_photo: "on" }));
    profile = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
    assert.equal(profile.photo, null);
    assert.equal(profile.photo_updated_at, null);

  } finally {
    await prisma.project.deleteMany({ where: { id: { in: projects } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
