import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../../lib/prisma";
import { addFile, canAddFiles, deleteFile, readFile, recordId } from "../../lib/files/service";
import { MAX_FILE_BYTES, MAX_FILES_PER_TASK } from "../../lib/files/limits";
import { getTaskDetails } from "../../lib/tasks/details";

test("task files are stored, read and deleted within their permissions", async () => {
  const prefix = "task-files-test-" + randomUUID();
  const users: number[] = [];
  let projectId: number | undefined;
  try {
    for (const suffix of ["owner", "contributor", "other", "outsider", "admin"]) {
      const user = await prisma.user.create({ data: {
        username: prefix + suffix, email: prefix + suffix + "@example.test", password: "unused-test-hash",
        first_name: "Test", last_name: suffix, role: suffix === "admin" ? "SUPER_ADMIN" : "USER",
      } });
      users.push(user.id);
    }
    const [owner, contributor, other, outsider] = users.map((id) => ({ id, role: "USER" as const }));
    const admin = { id: users[4], role: "SUPER_ADMIN" as const };
    const project = await prisma.project.create({ data: {
      name: prefix, start_date: new Date("2026-10-25"), owner_id: owner.id,
      memberships: { create: [
        { user_id: owner.id, role: "OWNER" }, { user_id: contributor.id, role: "CONTRIBUTOR" }, { user_id: other.id, role: "CONTRIBUTOR" },
      ] },
    } });
    projectId = project.id;
    const task = await prisma.task.create({ data: { title: "Files", project_id: project.id, created_by: owner.id } });
    const note = new TextEncoder().encode("zażółć");
    const image = new Uint8Array(await sharp({ create: { width: 900, height: 600, channels: 3, background: "#1f6f6b" } }).png().toBuffer());

    // Every member (and a super admin) adds files; nobody else does.
    const text = await addFile(contributor, task.id, "C:\\notes\\notatka.txt", note);
    const picture = await addFile(owner, task.id, "screen.png", image);
    const byAdmin = await addFile(admin, task.id, "from-it.txt", note);
    await assert.rejects(addFile(outsider, task.id, "a.txt", note), /no longer available/);
    await assert.rejects(addFile(owner, 2_000_000_000, "a.txt", note), /no longer available/);
    assert.deepEqual([await canAddFiles(contributor, task.id), await canAddFiles(outsider, task.id), await canAddFiles(admin, task.id)], [true, false, true]);

    // Only allowed, honest content.
    await assert.rejects(addFile(owner, task.id, "a.svg", note), /Choose a/);
    await assert.rejects(addFile(owner, task.id, "a.png", note), /does not match/);
    await assert.rejects(addFile(owner, task.id, "a.png", image.slice(0, 60)), /damaged/);
    await assert.rejects(addFile(owner, task.id, "a.txt", new Uint8Array()), /empty/);
    await assert.rejects(addFile(owner, task.id, "a.txt", new Uint8Array(MAX_FILE_BYTES + 1).fill(65)), /up to 10/);

    const stored = await readFile(other, text.id, false);
    assert.deepEqual([stored?.name, stored?.type, Buffer.from(stored!.data).toString()], ["notatka.txt", "text/plain", "zażółć"]);
    const full = await readFile(contributor, picture.id, false);
    assert.equal(Buffer.compare(Buffer.from(full!.data), Buffer.from(image)), 0, "the original is kept byte for byte");
    const preview = await readFile(contributor, picture.id, true);
    assert.equal(preview?.type, "image/webp");
    assert.ok((await sharp(Buffer.from(preview!.data)).metadata()).width! <= 480);
    assert.equal(await readFile(owner, text.id, true), null, "only images have a preview");
    assert.equal(await readFile(outsider, text.id, false), null);
    assert.equal(await readFile(outsider, picture.id, true), null);
    assert.ok(await readFile(admin, text.id, false));

    const seen = await getTaskDetails(contributor, task.id);
    assert.deepEqual(seen?.files.map((file) => [file.name, file.size, file.mine, file.isImage, file.uploader.firstName]),
      [["notatka.txt", note.length, true, false, "Test"], ["screen.png", image.length, false, true, "Test"], ["from-it.txt", note.length, false, false, "Administrator"]]);
    assert.ok(seen?.files.every((file) => !("data" in file)), "the list never carries the content");

    // The uploader and whoever runs the tasks delete.
    await assert.rejects(deleteFile(other, text.id), /only delete files you added/);
    await assert.rejects(deleteFile(contributor, picture.id), /only delete files you added/);
    await assert.rejects(deleteFile(outsider, text.id), /no longer available/);
    await deleteFile(contributor, text.id);
    await deleteFile(owner, byAdmin.id);
    await assert.rejects(deleteFile(owner, byAdmin.id), /no longer available/);

    // Uploads sent together cannot pass the limit.
    const results = await Promise.allSettled(Array.from({ length: MAX_FILES_PER_TASK + 2 }, (_, index) => addFile(owner, task.id, `f${index}.txt`, note)));
    assert.equal(await prisma.taskFile.count({ where: { task_id: task.id } }), MAX_FILES_PER_TASK);
    const refused = results.filter((result) => result.status === "rejected");
    assert.equal(refused.length, 3);
    for (const result of refused) assert.match(String(result.reason), /up to 10 files/);

    // Leaving the project ends the access; a deleted account leaves its files.
    const kept = await prisma.taskFile.findFirstOrThrow({ where: { task_id: task.id } });
    await prisma.taskFile.update({ where: { id: kept.id }, data: { uploader_id: contributor.id } });
    await prisma.projectMembership.delete({ where: { project_id_user_id: { project_id: project.id, user_id: contributor.id } } });
    assert.equal(await readFile(contributor, kept.id, false), null);
    await assert.rejects(deleteFile(contributor, kept.id), /no longer available/);
    await prisma.user.delete({ where: { id: contributor.id } });
    assert.equal((await getTaskDetails(owner, task.id))?.files.find((file) => file.id === kept.id)?.uploader.firstName, "Former");

    for (const value of ["0", "-1", "1.5", "abc", "99999999999", "1e3"]) assert.throws(() => recordId(value), /Invalid/);

    // Files go with their task.
    await prisma.task.delete({ where: { id: task.id } });
    assert.equal(await prisma.taskFile.count({ where: { task_id: task.id } }), 0);
  } finally {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
