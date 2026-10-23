"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/src/generated/prisma/client";
import { toCustomTemplate } from "./data";
import { parseTemplateInput, type DocumentTemplate } from "./template-schema";

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

// TODO(auth): Restrict saving and deleting to the template's owner.

function parseCustomId(templateId: string) {
  const match = /^custom-(\d+)$/.exec(templateId);
  return match ? Number(match[1]) : null;
}

export async function saveTemplate(
  templateId: string | null,
  input: unknown,
): Promise<ActionResult<DocumentTemplate>> {
  const parsed = parseTemplateInput(input);
  if (!parsed.ok) return parsed;

  const data = {
    name: parsed.value.name,
    description: parsed.value.description || null,
    blocks: parsed.value.blocks as Prisma.InputJsonValue,
  };

  try {
    const id = templateId ? parseCustomId(templateId) : null;
    if (templateId && id === null) return { ok: false, error: "Built-in templates cannot be changed." };

    const record = id
      ? await prisma.documentTemplate.update({ where: { id }, data })
      : await prisma.documentTemplate.create({ data });
    return { ok: true, value: toCustomTemplate(record) };
  } catch {
    return { ok: false, error: "The template could not be saved. Try again." };
  }
}

export async function deleteTemplate(templateId: string): Promise<ActionResult<null>> {
  const id = parseCustomId(templateId);
  if (id === null) return { ok: false, error: "Built-in templates cannot be deleted." };

  try {
    await prisma.documentTemplate.delete({ where: { id } });
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "The template could not be deleted. Try again." };
  }
}
