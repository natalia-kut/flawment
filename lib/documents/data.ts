import { prisma } from "@/lib/prisma";
import { plainText } from "@/lib/rich-text/markdown";
import { requireUser } from "@/lib/auth/session";
import { visibleProjects } from "@/lib/rbac";
import { relevantAbsences, toRanges, upcomingRanges } from "@/lib/time-off/availability";
import { addDays, workspaceDay, workspaceToday } from "@/lib/time-off/dates";
import { MAX_ACTIVITY_DAYS } from "./activity";
import { builtInTemplates } from "./built-in-templates";
import { parseBlocks, type DocumentTemplate } from "./template-schema";
import type { DocumentPerson, DocumentProject } from "./types";

// Never select passwords or other private user fields.
const personSelect = { id: true, first_name: true, last_name: true, email: true, username: true, role: true } as const;

type PersonRecord = { id: number; first_name: string; last_name: string; email: string; username: string; role: string };

function toPerson(user: PersonRecord, showAdmins: boolean): DocumentPerson {
  if (user.role === "SUPER_ADMIN" && !showAdmins) {
    return { id: 0, name: "Workspace administrator", email: "", username: "" };
  }
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
  const user = await requireUser();
  const today = workspaceToday();
  const visiblePerson = (person: PersonRecord) => toPerson(person, user.role === "SUPER_ADMIN");
  const projects = await prisma.project.findMany({
    where: visibleProjects(user),
    orderBy: [{ start_date: "desc" }, { id: "asc" }],
    include: {
      owner: { select: personSelect },
      memberships: { where: user.role === "SUPER_ADMIN" ? {} : { user: { role: "USER" } }, include: { user: { select: {
        ...personSelect,
        // A document can leave the company, so the reason for an absence is not even read.
        absences: { where: relevantAbsences(today), select: { start_date: true, end_date: true } },
      } } }, orderBy: { joined_at: "asc" } },
      tasks: {
        include: { assignee: { select: personSelect }, creator: { select: personSelect }, stage: { select: { id: true, name: true, deadline: true } },
          comments: { where: { deleted_at: null, created_at: { gte: new Date(addDays(today, -MAX_ACTIVITY_DAYS)) } }, select: { created_at: true } },
          // Never the contents: they can be large.
          files: { select: { id: true, name: true, created_at: true } } },
        orderBy: { id: "asc" },
      },
      stages: { select: { id: true, name: true, deadline: true }, orderBy: { id: "asc" } },
    },
  });
  const toStage = (stage: { id: number; name: string; deadline: Date | null }) =>
    ({ id: stage.id, name: stage.name, deadline: stage.deadline ? toDay(stage.deadline) : null });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: toDay(project.start_date),
    endDate: project.end_date ? toDay(project.end_date) : null,
    owner: visiblePerson(project.owner),
    members: project.memberships.map((membership) => ({
      person: visiblePerson(membership.user),
      role: membership.role,
      joinedAt: toDay(membership.joined_at),
      // Only the time off colleagues may know about (within the lookahead), joined with what touches it.
      absences: upcomingRanges(toRanges(membership.user.absences), today).map(({ start, end }) => ({ start, end })),
    })),
    stages: project.stages.map(toStage),
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      // Documents show text in table cells, without the formatting.
      description: plainText(task.description) || null,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? toDay(task.deadline) : null,
      assignee: task.assignee ? visiblePerson(task.assignee) : null,
      creator: visiblePerson(task.creator),
      stage: task.stage ? toStage(task.stage) : null,
      createdOn: workspaceDay(task.created_at),
      completedOn: task.completed_at ? workspaceDay(task.completed_at) : null,
      commentDays: task.comments.map((comment) => workspaceDay(comment.created_at)),
      files: task.files.map((file) => ({ id: file.id, name: file.name, addedOn: workspaceDay(file.created_at) })),
    })),
  }));
}

export function toCustomTemplate(record: {
  id: number;
  name: string;
  description: string | null;
  blocks: unknown;
  project_id: number | null;
  show_status: boolean;
  show_name: boolean;
  updated_at?: Date;
}): DocumentTemplate {
  return {
    id: `custom-${record.id}`,
    name: record.name,
    description: record.description ?? "",
    blocks: parseBlocks(record.blocks),
    isBuiltIn: false,
    projectId: record.project_id,
    showStatus: record.show_status,
    showName: record.show_name,
    version: record.updated_at?.toISOString(),
  };
}

export async function getDocumentTemplates(): Promise<DocumentTemplate[]> {
  const user = await requireUser();
  const custom = await prisma.documentTemplate.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { owner_id: user.id }, orderBy: { created_at: "asc" } });
  return [...builtInTemplates, ...custom.map(toCustomTemplate)];
}
