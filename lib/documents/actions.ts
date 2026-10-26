"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { visibleProjects, type Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";
import { getDocumentProjects, toCustomTemplate } from "./data";
import { localDay } from "./engine";
import { parseTemplateInput, type DocumentTemplate } from "./template-schema";
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

// Creates a template in projectId; editing keeps the template in its project.
export async function saveTemplate(
  templateId: string | null,
  input: unknown,
  projectId: number | null = null,
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

    const record = id
      ? await prisma.documentTemplate.update({ where: { id, ...ownTemplates(user) }, data })
      : await prisma.documentTemplate.create({ data: { ...data, owner_id: user.id, project_id: projectId } });
    return { ok: true, value: toCustomTemplate(record) };
  } catch {
    return { ok: false, error: "The template could not be saved. Try again." };
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
  return { projects: await getDocumentProjects(), today: localDay() };
}
