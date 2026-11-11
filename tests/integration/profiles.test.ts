import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../../lib/prisma";
import { updateProfile, profileVisibility } from "../../lib/profiles/service";
import { mutateSpecialization } from "../../lib/specializations/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("profiles and specializations respect account and project boundaries", async () => {
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
    const update = form({ description: "Backend engineer", user_id: users[1], role: "SUPER_ADMIN" });
    update.set("photo", new File([new Uint8Array(png)], "photo.png", { type: "image/png" }));
    await updateProfile(actor(0), update);
    let profile = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
    assert.equal(profile.description, "Backend engineer");
    assert.equal(profile.role, "USER");
    assert.ok(profile.photo && profile.photo_updated_at);
    assert.equal((await sharp(profile.photo).metadata()).format, "webp");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[1] } })).description, null);
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(2), users[0]) }), 1);
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(3), users[0]) }), 0);
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(0), users[4]) }), 0);
    assert.equal(await prisma.user.count({ where: profileVisibility(actor(4), users[0]) }), 1);
    await assert.rejects(updateProfile(actor(0), form({ description: "x".repeat(2001) })), /2000/);
    await updateProfile(actor(0), form({ description: "Updated bio" }));
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).photo, "description-only updates preserve the photo");
    await updateProfile(actor(0), form({ description: "Updated bio", remove_photo: "on" }));
    profile = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
    assert.equal(profile.photo, null);
    assert.equal(profile.photo_updated_at, null);

    const input = (operation: string, values: Record<string, string | number> = {}) => form({ project_id: projects[0], operation, ...values });
    const backend = await mutateSpecialization(actor(0), input("create", { name: "Backend" }));
    const frontend = await mutateSpecialization(actor(0), input("create", { project_id: projects[1], name: "Frontend" }));
    await assert.rejects(mutateSpecialization(actor(0), input("create", { name: "  BACKEND  " })), /already exists/);
    for (const index of [1, 2, 3]) await assert.rejects(mutateSpecialization(actor(index), input("create", { name: "Forbidden" })), /Only project admins/);
    await mutateSpecialization(actor(0), input("assign", { user_id: users[2], specialization_id: backend.id }));
    await mutateSpecialization(actor(0), input("assign", { project_id: projects[1], user_id: users[2], specialization_id: frontend.id }));
    const membership = (projectId: number) => prisma.projectMembership.findUniqueOrThrow({ where: { project_id_user_id: { project_id: projectId, user_id: users[2] } } });
    assert.equal((await membership(projects[0])).specialization_id, backend.id);
    assert.equal((await membership(projects[1])).specialization_id, frontend.id);
    assert.equal((await membership(projects[0])).role, "PARTICIPANT");
    await assert.rejects(mutateSpecialization(actor(0), input("assign", { user_id: users[2], specialization_id: frontend.id })), /this project/);
    await assert.rejects(prisma.projectMembership.update({ where: { project_id_user_id: { project_id: projects[0], user_id: users[2] } }, data: { specialization_id: frontend.id } }), /Foreign key constraint/);
    await assert.rejects(mutateSpecialization(actor(0), input("assign", { user_id: users[3], specialization_id: backend.id })), /member/);
    await assert.rejects(mutateSpecialization(actor(2), input("assign", { user_id: users[2], specialization_id: backend.id })), /Only project admins/);
    await mutateSpecialization(actor(0), input("assign", { user_id: users[0], specialization_id: backend.id }));
    await mutateSpecialization(actor(0), input("assign", { user_id: users[2], specialization_id: "" }));
    assert.equal((await membership(projects[0])).specialization_id, null);
    await mutateSpecialization(actor(4), input("rename", { specialization_id: backend.id, name: "API engineering" }));
    await mutateSpecialization(actor(0), input("delete", { specialization_id: backend.id }));
    assert.equal((await prisma.projectMembership.findUniqueOrThrow({ where: { project_id_user_id: { project_id: projects[0], user_id: users[0] } } })).specialization_id, null);
    await prisma.project.delete({ where: { id: projects[1] } });
    assert.equal(await prisma.projectSpecialization.count({ where: { project_id: projects[1] } }), 0);
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: projects } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
