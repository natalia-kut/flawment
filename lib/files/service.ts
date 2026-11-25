import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { can, visibleProjects, type Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";
import { cleanFileName, detectType } from "./detect";
import { ALLOWED_FILES, fileProblem, MAX_FILES_PER_TASK } from "./limits";

export class FileError extends Error {}

const MAX_INT = 2_147_483_647;

export function recordId(value: string) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > MAX_INT) throw new FileError("Invalid record ID.");
  return Number(value);
}

async function roleIn(tx: Prisma.TransactionClient, actor: Actor, projectId: number) {
  const member = await tx.projectMembership.findUnique({
    where: { project_id_user_id: { project_id: projectId, user_id: actor.id } }, select: { role: true },
  });
  return member?.role ?? null;
}

/** A small preview, which also proves that the image can really be read. */
async function makeThumbnail(data: Uint8Array) {
  try {
    return await sharp(data, { limitInputPixels: 50_000_000 }).rotate()
      .resize(480, 360, { fit: "cover", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  } catch {
    throw new FileError("This image is damaged or too large (up to 50 megapixels).");
  }
}

const unavailable = "This task is no longer available.";

/** May this person add files to the task? Asked before a body of up to 10 MB is read. */
export async function canAddFiles(actor: Actor, taskId: number) {
  return await prisma.task.count({ where: { id: taskId, project: visibleProjects(actor) } }) === 1;
}

/** Everyone who sees a task may attach files to it, as with comments. */
export async function addFile(actor: Actor, taskId: number, rawName: string, data: Uint8Array) {
  const name = cleanFileName(rawName);
  const problem = fileProblem({ name, size: data.length });
  if (problem) throw new FileError(problem);
  const type = detectType(name, data);
  if (!type) throw new FileError(`The content of this file does not match its name. Choose a ${ALLOWED_FILES} file without macros.`);
  if (!await canAddFiles(actor, taskId)) throw new FileError(unavailable);
  const thumbnail = type.startsWith("image/") ? await makeThumbnail(data) : null;

  return prisma.$transaction(async (tx) => {
    // Uploads to one task wait for each other here, so two at once cannot both be "the tenth".
    const [task] = await tx.$queryRaw<{ project_id: number }[]>`SELECT project_id FROM "Task" WHERE id = ${taskId} FOR NO KEY UPDATE`;
    if (!task || !can(await roleIn(tx, actor, task.project_id), "project:read", actor.role)) throw new FileError(unavailable);
    if (await tx.taskFile.count({ where: { task_id: taskId } }) >= MAX_FILES_PER_TASK) {
      throw new FileError(`A task can have up to ${MAX_FILES_PER_TASK} files.`);
    }
    return tx.taskFile.create({
      data: {
        task_id: taskId, uploader_id: actor.id, name, type, size: data.length,
        data: new Uint8Array(data), thumbnail: thumbnail && new Uint8Array(thumbnail),
      },
      select: { id: true },
    });
  }, { timeout: 20_000 });
}

/** Whoever added the file, or whoever runs the project's tasks. */
export async function deleteFile(actor: Actor, fileId: number) {
  return prisma.$transaction(async (tx) => {
    const file = await tx.taskFile.findUnique({
      where: { id: fileId }, select: { uploader_id: true, task: { select: { project_id: true } } },
    });
    const role = file && await roleIn(tx, actor, file.task.project_id);
    if (!file || !can(role, "project:read", actor.role)) throw new FileError("This file is no longer available.");
    if (file.uploader_id !== actor.id && !can(role, "tasks:manage", actor.role)) {
      throw new FileError("You can only delete files you added.");
    }
    await tx.taskFile.deleteMany({ where: { id: fileId } });
  });
}

/** A file's content, for someone who can see its task right now. */
export async function readFile(actor: Actor, fileId: number, thumbnail: boolean) {
  const where = { id: fileId, task: { project: visibleProjects(actor) } };
  if (thumbnail) {
    const file = await prisma.taskFile.findFirst({ where, select: { name: true, thumbnail: true } });
    return file?.thumbnail ? { name: file.name, type: "image/webp", data: file.thumbnail } : null;
  }
  return prisma.taskFile.findFirst({ where, select: { name: true, type: true, data: true } });
}
