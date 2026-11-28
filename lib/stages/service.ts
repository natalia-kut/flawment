import { can, type Actor } from "@/lib/rbac";
import { serializable } from "@/lib/transaction";
import { normalizeNewlines } from "@/lib/rich-text/markdown";
import { cleanLine } from "@/lib/text";

export class StageError extends Error {}
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
function id(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new StageError("Invalid record ID.");
  }
  return Number(value);
}
export async function mutateStage(actor: Actor, data: FormData) {
  const projectId = id(text(data, "project_id"));
  const operation = text(data, "operation");
  if (!["create", "update", "delete"].includes(operation)) throw new StageError("Unknown stage operation.");
  const stageId = operation === "create" ? null : id(text(data, "stage_id"));
  const name = cleanLine(text(data, "name"));
  // Forms send line breaks as \r\n; counted as one, as the browser does.
  const description = normalizeNewlines(text(data, "description"));
  const deadline = text(data, "deadline");
  if (operation !== "delete") {
    if (!name || name.length > 120) throw new StageError("Enter a stage name between 1 and 120 characters.");
    if (description.length > 4000) throw new StageError("Description must not exceed 4000 characters.");
    if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline)) {
      throw new StageError("Enter a valid deadline.");
    }
  }
  return serializable(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { memberships: true } });
    const role = project?.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
    if (!project || !can(role, "project:update", actor.role)) throw new StageError("You do not have permission to manage stages in this project.");
    if (stageId !== null && !await tx.projectStage.findFirst({ where: { id: stageId, project_id: projectId } })) {
      throw new StageError("This stage is no longer available in this project.");
    }
    if (operation === "delete") {
      // The foreign key clears task.stage_id and preserves the tasks.
      return tx.projectStage.delete({ where: { id: stageId!, project_id: projectId } });
    }
    // Compared here rather than with `mode: "insensitive"`, an ILIKE in which
    // `_` and `%` are wildcards ("A_1" would clash with "AB1").
    const others = await tx.projectStage.findMany({
      where: { project_id: projectId, ...(stageId ? { id: { not: stageId } } : {}) }, select: { name: true },
    });
    const key = name.toLocaleLowerCase("pl");
    if (others.some((stage) => stage.name.toLocaleLowerCase("pl") === key)) throw new StageError("A stage with this name already exists in this project.");
    const values = { name, description: description || null, deadline: deadline ? new Date(deadline) : null };
    return stageId === null
      ? tx.projectStage.create({ data: { ...values, project_id: projectId } })
      : tx.projectStage.update({ where: { id: stageId, project_id: projectId }, data: values });
  });
}
