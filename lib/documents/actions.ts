"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { visibleProjects, type Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";
import { getDocumentProjects, toCustomTemplate } from "./data";
import { workspaceToday } from "@/lib/time-off/dates";
import { parseTemplateInput, templateLimits, type DocumentTemplate } from "./template-schema";
import type { DocumentProject } from "./types";

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseCustomId(templateId: string) {
  const match = /^custom-(\d+)$/.exec(templateId);
  return match ? Number(match[1]) : null;
}

function ownTemplates(user: Actor) {
  return user.role === "SUPER_ADMIN" ? {} : { owner_id: user.id };
}

async function canUseProject(user: Actor, projectId: number) {
  return (await prisma.project.count({ where: { id: projectId, ...visibleProjects(user) } })) > 0;
}

const STALE = "This template was changed somewhere else in the meantime (another tab or Flawiusz). Your edits are still here: copy what you need, then reload the page to see the latest version.";

/**
 * Creates a template in projectId; editing keeps the template in its project.
 * `expectedVersion` (the template's `version` when the editor opened) refuses to
 * replace a template that was saved since, so an old copy never wins silently.
 */
export async function saveTemplate(
  templateId: string | null,
  input: unknown,
  projectId: number | null = null,
  expectedVersion?: string,
): Promise<ActionResult<DocumentTemplate>> {
  const user = await requireUser();
  const parsed = parseTemplateInput(input);
  if (!parsed.ok) return parsed;

  const data = {
    name: parsed.value.name,
    description: parsed.value.description || null,
    blocks: parsed.value.blocks as Prisma.InputJsonValue,
    show_status: parsed.value.showStatus,
    show_name: parsed.value.showName,
  };

  try {
    const id = templateId ? parseCustomId(templateId) : null;
    if (templateId && id === null) return { ok: false, error: "Built-in templates cannot be changed." };
    if (!id && projectId !== null && !(await canUseProject(user, projectId))) {
      return { ok: false, error: "You do not have access to this project." };
    }

    if (id && expectedVersion) {
      const version = new Date(expectedVersion);
      if (Number.isNaN(version.getTime())) return { ok: false, error: STALE };
      const changed = await prisma.documentTemplate.updateMany({ where: { id, ...ownTemplates(user), updated_at: version }, data });
      if (changed.count !== 1) {
        const exists = await prisma.documentTemplate.count({ where: { id, ...ownTemplates(user) } });
        return { ok: false, error: exists ? STALE : "This template no longer exists." };
      }
      return { ok: true, value: toCustomTemplate(await prisma.documentTemplate.findUniqueOrThrow({ where: { id } })) };
    }
    const record = id
      ? await prisma.documentTemplate.update({ where: { id, ...ownTemplates(user) }, data })
      : await prisma.documentTemplate.create({ data: { ...data, owner_id: user.id, project_id: projectId } });
    return { ok: true, value: toCustomTemplate(record) };
  } catch {
    return { ok: false, error: "The template could not be saved. Try again." };
  }
}

/** Changes only the name, so renaming from an old page cannot bring back old content. */
export async function renameTemplate(templateId: string, name: string): Promise<ActionResult<DocumentTemplate>> {
  const user = await requireUser();
  const id = parseCustomId(templateId);
  if (id === null) return { ok: false, error: "Built-in templates cannot be changed." };
  const trimmed = String(name ?? "").trim();
  if (!trimmed || trimmed.length > templateLimits.name) return { ok: false, error: `Enter a name of up to ${templateLimits.name} characters.` };
  try {
    const changed = await prisma.documentTemplate.updateMany({ where: { id, ...ownTemplates(user) }, data: { name: trimmed } });
    if (changed.count !== 1) return { ok: false, error: "This template no longer exists." };
    return { ok: true, value: toCustomTemplate(await prisma.documentTemplate.findUniqueOrThrow({ where: { id } })) };
  } catch {
    return { ok: false, error: "The template could not be renamed. Try again." };
  }
}

export async function copyTemplate(templateId: string, projectId: number): Promise<ActionResult<DocumentTemplate>> {
  const user = await requireUser();
  const id = parseCustomId(templateId);
  if (id === null) return { ok: false, error: "Built-in templates are already available in every project." };

  try {
    const source = await prisma.documentTemplate.findFirst({ where: { id, ...ownTemplates(user) } });
    if (!source) return { ok: false, error: "The template could not be found." };
    if (!(await canUseProject(user, projectId))) return { ok: false, error: "You do not have access to this project." };

    const record = await prisma.documentTemplate.create({
      data: {
        name: source.name,
        description: source.description,
        blocks: source.blocks as Prisma.InputJsonValue,
        show_status: source.show_status,
        show_name: source.show_name,
        owner_id: user.id,
        project_id: projectId,
      },
    });
    return { ok: true, value: toCustomTemplate(record) };
  } catch {
    return { ok: false, error: "The template could not be copied. Try again." };
  }
}

export async function deleteTemplate(templateId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const id = parseCustomId(templateId);
  if (id === null) return { ok: false, error: "Built-in templates cannot be deleted." };

  try {
    await prisma.documentTemplate.delete({ where: { id, ...ownTemplates(user) } });
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "The template could not be deleted. Try again." };
  }
}

export async function getPreviewData(): Promise<{ projects: DocumentProject[]; today: string }> {
  return { projects: await getDocumentProjects(), today: workspaceToday() };
}
