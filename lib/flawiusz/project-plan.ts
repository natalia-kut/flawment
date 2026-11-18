import { prisma } from "@/lib/prisma";
import { canStartProject } from "@/lib/projects/service";
import type { Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";
import { projectPlanSchema } from "./project-plan-schema";

export class ProjectPlanError extends Error {}

export async function prepareProjectPlan(actor: Actor, input: unknown, db: Prisma.TransactionClient = prisma) {
  if (!await canStartProject(actor, db)) throw new ProjectPlanError("Only managers and super admins can start a project.");
  const parsed = projectPlanSchema.safeParse(input);
  if (!parsed.success) throw new ProjectPlanError("Some project or task details are invalid.");
  const plan = parsed.data;
  const { start_date: start, end_date: end, tasks } = plan;
  if (end && end < start) throw new ProjectPlanError("The project end date must follow its start date.");
  const inProject = (date: string) => date >= start && (!end || date <= end);
  for (const task of tasks) {
    const { deadline, work_from: from, work_to: to } = task;
    if (deadline && !inProject(deadline)) throw new ProjectPlanError(`Set a deadline within the project dates for "${task.title}".`);
    if (from || to || task.assignee_id) {
      if (!from || !to || from > to || !inProject(from) || !inProject(to) || (deadline && to > deadline)) {
        throw new ProjectPlanError(`Set a valid work window for "${task.title}" within the project dates and by its deadline.`);
      }
    }
  }

  const ids = [...new Set(tasks.flatMap((task) => task.assignee_id ? [task.assignee_id] : []))];
  const people = ids.length ? await db.user.findMany({
    where: { id: { in: ids }, role: "USER", is_active: true },
    select: { id: true, first_name: true, last_name: true },
  }) : [];
  if (people.length !== ids.length) throw new ProjectPlanError("An assignee is no longer an active, eligible user.");
  for (const task of tasks) {
    if (!task.assignee_id) continue;
    const absence = await db.absence.findFirst({
      where: { user_id: task.assignee_id, start_date: { lte: new Date(task.work_to!) }, end_date: { gte: new Date(task.work_from!) } },
      select: { id: true },
    });
    if (absence) throw new ProjectPlanError(`The assignee for "${task.title}" is away during the planned work window. Change the dates or the assignee.`);
  }
  return { plan, people: people.map((user) => ({ id: user.id, name: `${user.first_name} ${user.last_name}` })) };
}

export async function createPlannedProject(actor: Actor, input: unknown) {
  return prisma.$transaction(async (tx) => {
    const { plan, people } = await prepareProjectPlan(actor, input, tx);
    return tx.project.create({
      data: {
        name: plan.name,
        description: plan.description || null,
        start_date: new Date(plan.start_date),
        end_date: plan.end_date ? new Date(plan.end_date) : null,
        owner_id: actor.id,
        memberships: {
          create: [
            { user_id: actor.id, role: "OWNER" },
            ...people.filter((person) => person.id !== actor.id).map((person) => ({ user_id: person.id, role: "CONTRIBUTOR" as const })),
          ],
        },
        tasks: {
          create: plan.tasks.map((task) => ({
            title: task.title,
            description: task.description || null,
            priority: task.priority,
            deadline: task.deadline ? new Date(task.deadline) : null,
            assigned_to: task.assignee_id,
            created_by: actor.id,
          })),
        },
      },
      select: { id: true, name: true },
    });
  }, { isolationLevel: "Serializable" });
}
