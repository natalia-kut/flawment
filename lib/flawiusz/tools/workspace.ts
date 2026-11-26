import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canStartProject } from "@/lib/projects/service";
import { visibleProjects } from "@/lib/rbac";
import { addDays, daySpan, workspaceDay } from "@/lib/time-off/dates";
import { day, projectPlanSchema, recordId } from "../project-plan-schema";
import { prepareProjectPlan, ProjectPlanError } from "../project-plan";
import { defineTool } from "./define";

const taskSelect = {
  id: true, title: true, status: true, priority: true, deadline: true, created_at: true, updated_at: true,
  project: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true } },
  assignee: { select: { id: true, first_name: true, last_name: true, role: true } },
} as const;

function publicTask<T extends { assignee: { role: string } | null }>(task: T, showAdmins: boolean) {
  return { ...task, assignee: task.assignee?.role === "SUPER_ADMIN" && !showAdmins ? null : task.assignee };
}

// Warsaw midnight converted to UTC, including when the requested week crosses a DST change.
function startOfDay(value: string) {
  const utc = new Date(value);
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw", hour: "numeric", hourCycle: "h23",
  }).format(utc));
  return new Date(utc.getTime() - hour * 3_600_000);
}

export const getProject = defineTool({
  name: "get_project",
  description: "Gets details and member IDs for a visible project. Use this to resolve assignees by name within a project.",
  status: "Opening the project…",
  input: z.object({ project_id: recordId }),
  async run({ project_id }, { actor }) {
    if (!actor) return { ok: false, error: "Sign in first." };
    const project = await prisma.project.findFirst({
      where: { id: project_id, ...visibleProjects(actor) },
      select: {
        id: true, name: true, description: true, status: true, start_date: true, end_date: true,
        memberships: {
          where: actor.role === "SUPER_ADMIN" ? {} : { user: { role: "USER" } },
          select: { role: true, user: { select: { id: true, first_name: true, last_name: true } } },
          orderBy: { id: "asc" }, take: 101,
        },
      },
    });
    if (!project) return { ok: false, error: "Project unavailable." };
    const { memberships, ...details } = project;
    return { ok: true, value: { ...details, members: memberships.slice(0, 100), moreMembers: memberships.length > 100 } };
  },
});

export const listTasks = defineTool({
  name: "list_tasks",
  description: "Lists tasks in visible projects. Filter by project, assignee, mine (current user), or title. Use last_week for the previous Monday to Sunday in Warsaw, or provide from/to (inclusive Warsaw dates). Provide date_field for either period. Updated is the last edit, not completion history. Use after_id to page.",
  status: "Looking up tasks…",
  input: z.object({
    project_id: recordId.optional(), assignee_id: recordId.optional(), mine: z.boolean().optional(),
    title: z.string().trim().min(1).max(100).optional(), after_id: recordId.optional(),
    from: day.optional(), to: day.optional(), last_week: z.boolean().optional(),
    date_field: z.enum(["deadline", "created_at", "updated_at"]).optional(),
  }),
  async run({ project_id, assignee_id, mine, title, after_id, from, to, last_week, date_field }, { actor }) {
    if (!actor) return { ok: false, error: "Sign in first." };
    if (last_week) {
      if (from || to) return { ok: false, error: "Use either last_week or explicit dates." };
      const today = workspaceDay(new Date());
      const monday = addDays(today, -((new Date(today).getUTCDay() + 6) % 7));
      from = addDays(monday, -7);
      to = addDays(monday, -1);
    }
    if ((from || to || date_field) && (!from || !to || !date_field || from > to)) {
      return { ok: false, error: "Provide an ordered from/to range and date_field." };
    }
    const period = from && to && date_field ? {
      [date_field]: { gte: date_field === "deadline" ? new Date(from) : startOfDay(from), lt: date_field === "deadline" ? new Date(addDays(to, 1)) : startOfDay(addDays(to, 1)) },
    } : {};
    const assignee = mine ? actor.id : assignee_id;
    const tasks = await prisma.task.findMany({
      where: {
        project: visibleProjects(actor), project_id, assigned_to: assignee,
        ...(assignee && actor.role !== "SUPER_ADMIN" ? { assignee: { role: "USER" } } : {}),
        ...(title ? { title: { contains: title, mode: "insensitive" } } : {}),
        ...(after_id ? { id: { lt: after_id } } : {}),
        ...period,
      },
      select: taskSelect, orderBy: { id: "desc" }, take: 26,
    });
    return { ok: true, value: {
      tasks: tasks.slice(0, 25).map((task) => publicTask(task, actor.role === "SUPER_ADMIN")),
      date_range: from && to ? { from, to, date_field } : null,
      next_after_id: tasks.length > 25 ? tasks[24].id : null,
    } };
  },
});

export const getTask = defineTool({
  name: "get_task",
  description: "Gets a task by ID, including its full description, project, stage, deadline, status, and assignee.",
  status: "Opening task details…",
  input: z.object({ task_id: recordId }),
  async run({ task_id }, { actor }) {
    if (!actor) return { ok: false, error: "Sign in first." };
    const task = await prisma.task.findFirst({
      where: { id: task_id, project: visibleProjects(actor) },
      select: { ...taskSelect, description: true },
    });
    if (!task) return { ok: false, error: "Task unavailable." };
    return { ok: true, value: publicTask(task, actor.role === "SUPER_ADMIN") };
  },
});

export const findPlanningCandidates = defineTool({
  name: "find_planning_candidates",
  description: "For authorized project creators, finds up to 20 active people by optional name/username search. Returns job title, whether any recorded absence overlaps the inclusive work window, and count of open tasks visible to the caller. Absence data is not a capacity calendar. Use separate calls for different work windows.",
  status: "Checking who is available…",
  input: z.object({ from: day, to: day, search: z.string().trim().min(1).max(100).optional() }),
  async run({ from, to, search }, { actor }) {
    if (!actor || !await canStartProject(actor)) return { ok: false, error: "Only managers and super admins can plan staffing for a new project." };
    if (from > to || daySpan(from, to) > 180) return { ok: false, error: "Provide an ordered work window of up to 180 days." };
    const people = await prisma.user.findMany({
      where: {
        is_active: true, role: "USER",
        ...(search ? { OR: search.split(/\s+/).flatMap((term) => [
          { first_name: { contains: term, mode: "insensitive" as const } },
          { last_name: { contains: term, mode: "insensitive" as const } },
          { username: { contains: term, mode: "insensitive" as const } },
        ]) } : {}),
      },
      select: {
        id: true, first_name: true, last_name: true, job_title: { select: { name: true } },
        absences: {
          where: { start_date: { lte: new Date(to) }, end_date: { gte: new Date(from) } },
          select: { start_date: true, end_date: true }, orderBy: { start_date: "asc" }, take: 10,
        },
        _count: {
          select: { assigned_tasks: { where: { project: visibleProjects(actor), status: { in: ["TO_DO", "IN_PROGRESS", "IN_REVIEW"] } } } },
        },
      },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }, { id: "asc" }], take: 21,
    });
    return { ok: true, value: {
      people: people.slice(0, 20).map((person) => ({
        id: person.id, name: `${person.first_name} ${person.last_name}`, jobTitle: person.job_title?.name,
        available: person.absences.length === 0,
        absences: person.absences.map(({ start_date, end_date }) => ({
          from: start_date.toISOString().slice(0, 10), to: end_date.toISOString().slice(0, 10),
        })),
        visibleOpenTasks: person._count.assigned_tasks,
      })),
      morePeople: people.length > 20,
    } };
  },
});

export const proposeProjectPlan = defineTool({
  name: "propose_project_plan",
  description: "Shows a review card for a NEW project and its initial tasks. Creates nothing until the user clicks Create project. Assigned active users will join as contributors. Check availability for each assigned work window first; leave tasks unassigned if no suitable person is known.",
  status: "Putting the project plan together…",
  input: projectPlanSchema,
  async run(plan, { actor }) {
    if (!actor) return { ok: false, error: "Sign in first." };
    try {
      return { ok: true, value: await prepareProjectPlan(actor, plan) };
    } catch (error) {
      if (error instanceof ProjectPlanError) return { ok: false, error: error.message };
      throw error;
    }
  },
  show(proposal, emit) {
    emit({ type: "project-plan", proposal });
    return { question: "Review the plan and click Create project when you're ready." };
  },
});
