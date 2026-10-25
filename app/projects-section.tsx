import { prisma } from "@/lib/prisma";
import CreateProjectForm from "./create-project-form";
import { createProject } from "./create-project-action";
import ProjectsView from "./projects-view";

const statusLabels = {
  TO_DO: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

export default async function ProjectsSection() {
  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      orderBy: [
        { created_at: "desc" },
        { id: "desc" },
      ],
      include: {
        tasks: {
          select: {
            status: true,
            deadline: true,
          },
        },
        memberships: {
          select: {
            user_id: true,
          },
        },
      },
    }),

    prisma.user.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        username: "asc",
      },
      select: {
        id: true,
        username: true,
        first_name: true,
        last_name: true,
      },
    }),
  ]);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const tableProjects = projects.map((project) => {
    const activeTasks = project.tasks.filter(
      (task) => task.status !== "CANCELLED",
    );

    const people = new Set([
      project.owner_id,
      ...project.memberships.map((member) => member.user_id),
    ]);

    return {
      id: project.id,
      name: project.name,
      deadline: project.end_date?.toISOString().slice(0, 10) ?? null,
      status: statusLabels[project.status],
      completedTasks: activeTasks.filter(
        (task) => task.status === "COMPLETED",
      ).length,
      totalTasks: activeTasks.length,
      overdueTasks: activeTasks.filter(
        (task) =>
          task.status !== "COMPLETED" &&
          task.deadline !== null &&
          task.deadline < today,
      ).length,
      people: people.size,
    };
  });

  const owners = users.map((user) => ({
    id: user.id,
    name:
      `${user.first_name} ${user.last_name}`.trim() ||
      user.username,
  }));

  return (
    <>
      <CreateProjectForm
        owners={owners}
        createAction={createProject}
      />

      <ProjectsView projects={tableProjects} />
    </>
  );
}