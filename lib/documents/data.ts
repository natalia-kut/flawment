import { prisma } from "@/lib/prisma";
import { builtInTemplates } from "./built-in-templates";
import { parseBlocks, type DocumentTemplate } from "./template-schema";
import type { DocumentPerson, DocumentProject } from "./types";

// Never select passwords or other private user fields.
const personSelect = { id: true, first_name: true, last_name: true, email: true, username: true } as const;

type PersonRecord = { id: number; first_name: string; last_name: string; email: string; username: string };

function toPerson(user: PersonRecord): DocumentPerson {
  return {
    id: user.id,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    username: user.username,
  };
}

function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getDocumentProjects(): Promise<DocumentProject[]> {
  const projects = await prisma.project.findMany({
    orderBy: [{ start_date: "desc" }, { id: "asc" }],
    include: {
      owner: { select: personSelect },
      memberships: { include: { user: { select: personSelect } }, orderBy: { joined_at: "asc" } },
      tasks: {
        include: { assignee: { select: personSelect }, creator: { select: personSelect } },
        orderBy: { id: "asc" },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: toDay(project.start_date),
    endDate: project.end_date ? toDay(project.end_date) : null,
    owner: toPerson(project.owner),
    members: project.memberships.map((membership) => ({
      person: toPerson(membership.user),
      role: membership.role,
      joinedAt: toDay(membership.joined_at),
    })),
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? toDay(task.deadline) : null,
      assignee: task.assignee ? toPerson(task.assignee) : null,
      creator: toPerson(task.creator),
    })),
  }));
}

export function toCustomTemplate(record: {
  id: number;
  name: string;
  description: string | null;
  blocks: unknown;
}): DocumentTemplate {
  return {
    id: `custom-${record.id}`,
    name: record.name,
    description: record.description ?? "",
    blocks: parseBlocks(record.blocks),
    isBuiltIn: false,
  };
}

export async function getDocumentTemplates(): Promise<DocumentTemplate[]> {
  const custom = await prisma.documentTemplate.findMany({ orderBy: { created_at: "asc" } });
  return [...builtInTemplates, ...custom.map(toCustomTemplate)];
}
