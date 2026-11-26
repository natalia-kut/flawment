import { readFileSync } from "node:fs";
import { prisma } from "../../lib/prisma";
import { addFile } from "../../lib/files/service";
import { absences, comments, files, projects, Q, S, stageDescriptions, taskDescriptions, teams, usernames, type P, type T } from "./story";

const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date()) + "T00:00:00Z");

/** The date `n` working days from today (a weekend "today" counts as the Friday before). */
function w(n: number) {
  const date = new Date(today);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  for (let left = Math.abs(n); left > 0;) {
    date.setUTCDate(date.getUTCDate() + Math.sign(n));
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left--;
  }
  return date;
}
function at(n: number, hour: number, minute = 0) { const date = w(n); date.setUTCHours(hour, minute); return date; }

/** A description someone wrote stays; only an empty one is filled in. */
const empty = { OR: [{ description: null }, { description: "" }] };

/**
 * Puts the sample story (story.ts) into the database, around today. Safe to run again: it finds its
 * own projects, stages, tasks, comments and files by name and moves them to the present. Anything
 * else in the workspace is left alone.
 */
export async function applyDemo() {
  const people = await prisma.user.findMany({ where: { username: { in: Object.values(usernames) } }, select: { id: true, username: true } });
  if (people.length !== Object.keys(usernames).length) throw new Error("The sample people are not here. Run npm run db:seed on an empty database first.");
  const id = (p: P) => people.find((user) => user.username === usernames[p])!.id;

  const taskIds = new Map<string, number>();
  await prisma.$transaction(async (tx) => {
    // Everyone steps down first: a team has one lead.
    await tx.user.updateMany({ where: { id: { in: people.map((user) => user.id) } }, data: { team_lead: false } });
    for (const [name, lead, members] of teams) {
      const team = await tx.team.upsert({ where: { name_key: name.toLowerCase() }, update: {}, create: { name, name_key: name.toLowerCase() } });
      await tx.user.updateMany({ where: { id: { in: members.map(id) } }, data: { team_id: team.id } });
      await tx.user.update({ where: { id: id(lead) }, data: { team_lead: true } });
      // A waiting request belongs to whoever leads the person now.
      await tx.jobTitleRequest.updateMany({ where: { status: "PENDING", user_id: { in: members.filter((m) => m !== lead).map(id) } }, data: { requested_by: id(lead) } });
    }

    for (const project of projects) {
      const values = {
        status: project.status, start_date: w(project.start), end_date: w(project.end), owner_id: id(project.owner),
      };
      const existing = await tx.project.findFirst({ where: { name: project.name }, select: { id: true } });
      const { id: projectId } = existing
        ? await tx.project.update({ where: { id: existing.id }, data: values, select: { id: true } })
        : await tx.project.create({ data: { ...values, name: project.name }, select: { id: true } });
      // An older seed wrote only the first sentence.
      const before = project.description.slice(0, project.description.indexOf(". ") + 1);
      await tx.project.updateMany({ where: { id: projectId, OR: [...empty.OR, { description: before }] }, data: { description: project.description } });
      for (const [index, [p, role]] of project.members.entries()) {
        const joined = at(Math.min(project.start + index, -1), 9);
        await tx.projectMembership.upsert({
          where: { project_id_user_id: { project_id: projectId, user_id: id(p) } },
          update: { role, joined_at: joined }, create: { project_id: projectId, user_id: id(p), role, joined_at: joined },
        });
      }
      const manager = project.members.find(([, role]) => role === "COORDINATOR")![0];
      const saveTask = async ([title, person, created, deadline, status, priority, completed]: T, stageId: number, index: number) => {
        const createdAt = at(created, 8 + (index % 6), (index * 7) % 60);
        const completedAt = completed === undefined ? null : at(completed, 10 + (index % 5), (index * 11) % 60);
        const data = {
          stage_id: stageId, assigned_to: person && id(person), created_by: id(index % 2 === 0 ? project.owner : manager), deadline: w(deadline),
          status: S[status], priority: Q[priority], created_at: createdAt, completed_at: completedAt,
          updated_at: completedAt ?? at(Math.max(created, -1 - (index % 4)), 12),
        };
        const found = await tx.task.findFirst({ where: { project_id: projectId, title }, select: { id: true } });
        const saved = found
          ? await tx.task.update({ where: { id: found.id }, data, select: { id: true } })
          : await tx.task.create({ data: { ...data, project_id: projectId, title }, select: { id: true } });
        const description = taskDescriptions[title];
        if (description) await tx.task.updateMany({ where: { id: saved.id, ...empty }, data: { description, updated_at: data.updated_at } });
        taskIds.set(title, saved.id);
      };
      let index = 0;
      for (const { name, was, deadline, tasks } of project.stages) {
        const stage = await tx.projectStage.findFirst({ where: { project_id: projectId, name: { in: [name, ...(was ? [was] : [])] } }, select: { id: true } });
        const saved = stage
          ? await tx.projectStage.update({ where: { id: stage.id }, data: { name, deadline: w(deadline) }, select: { id: true } })
          : await tx.projectStage.create({ data: { project_id: projectId, name, deadline: w(deadline) }, select: { id: true } });
        await tx.projectStage.updateMany({ where: { id: saved.id, ...empty }, data: { description: stageDescriptions[project.name]?.[name] ?? null } });
        for (const task of tasks) await saveTask(task, saved.id, index++);
      }
    }

    for (const [p, type, from, to, note] of absences) {
      const overlap = await tx.absence.findFirst({ where: { user_id: id(p), start_date: { lte: w(to) }, end_date: { gte: w(from) } } });
      if (!overlap) await tx.absence.create({ data: { user_id: id(p), type, start_date: w(from), end_date: w(to), note } });
    }

    let parent: number | null = null;
    for (const [title, author, days, hour, body, reply] of comments) {
      const taskId = taskIds.get(title)!;
      const found = await tx.taskComment.findFirst({ where: { task_id: taskId, body }, select: { id: true } });
      const data: { task_id: number; author_id: number; body: string; created_at: Date; parent_id: number | null } = { task_id: taskId, author_id: id(author), body, created_at: at(days, hour, 12), parent_id: reply ? parent : null };
      const saved: { id: number } = found ? await tx.taskComment.update({ where: { id: found.id }, data, select: { id: true } }) : await tx.taskComment.create({ data, select: { id: true } });
      if (!reply) parent = saved.id;
    }

    await tx.user.update({ where: { id: id("P") }, data: { status_emoji: "🏠", status_text: "Working from home", status_expires_at: null } });
    await tx.user.update({ where: { id: id("J") }, data: { status_emoji: "🎧", status_text: "Focus time", status_expires_at: null } });
  }, { timeout: 60_000 });

  for (const [title, name, uploader, days] of files) {
    const taskId = taskIds.get(title)!;
    let file = await prisma.taskFile.findFirst({ where: { task_id: taskId, name }, select: { id: true } });
    file ??= await addFile({ id: id(uploader), role: "USER" }, taskId, name, readFileSync(new URL("./files/" + name, import.meta.url)));
    await prisma.taskFile.update({ where: { id: file.id }, data: { created_at: at(days, 11) } });
  }
  console.log(`Saved ${projects.length} projects, ${taskIds.size} tasks, ${comments.length} comments and ${files.length} files.`);
}
