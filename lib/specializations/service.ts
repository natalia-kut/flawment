import { prisma } from "@/lib/prisma";
import { can, type Actor } from "@/lib/rbac";

export class SpecializationError extends Error {}
function id(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new SpecializationError("Invalid record ID.");
  return Number(text);
}

export async function mutateSpecialization(actor: Actor, data: FormData) {
  const projectId = id(data.get("project_id"));
  const operation = String(data.get("operation"));
  if (!["create", "rename", "delete", "assign"].includes(operation)) throw new SpecializationError("Unknown specialization operation.");
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { memberships: true } });
    const role = project?.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
    if (!project || !can(role, "specializations:manage", actor.role)) throw new SpecializationError("Only project admins can manage specializations.");
    const specializationId = operation === "create" || (operation === "assign" && !data.get("specialization_id")) ? null : id(data.get("specialization_id"));
    if (specializationId !== null && !await tx.projectSpecialization.findFirst({ where: { id: specializationId, project_id: projectId } })) {
      throw new SpecializationError("Choose a specialization from this project.");
    }
    if (operation === "assign") {
      const userId = id(data.get("user_id"));
      const member = project.memberships.find((m) => m.user_id === userId);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true } });
      if (!member || !user?.is_active || user.role === "SUPER_ADMIN") throw new SpecializationError("Choose an active standard member of this project.");
      return tx.projectMembership.update({ where: { id: member.id }, data: { specialization_id: specializationId } });
    }
    if (operation === "delete") {
      await tx.projectMembership.updateMany({ where: { project_id: projectId, specialization_id: specializationId }, data: { specialization_id: null } });
      return tx.projectSpecialization.delete({ where: { id: specializationId!, project_id: projectId } });
    }
    const name = String(data.get("name") ?? "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 80) throw new SpecializationError("Use a specialization name between 1 and 80 characters.");
    const name_key = name.toLowerCase();
    if (await tx.projectSpecialization.findFirst({ where: { project_id: projectId, name_key, ...(specializationId ? { id: { not: specializationId } } : {}) } })) {
      throw new SpecializationError("This specialization already exists in this project.");
    }
    return operation === "create"
      ? tx.projectSpecialization.create({ data: { project_id: projectId, name, name_key } })
      : tx.projectSpecialization.update({ where: { id: specializationId!, project_id: projectId }, data: { name, name_key } });
  }, { isolationLevel: "Serializable" });
}
