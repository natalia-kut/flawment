import styles from "./projects-view.module.css";

type ProjectRow = {
  id: number;
  name: string;
  deadline: string | null;
  status: string;
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  people: number;
};

type ProjectsViewProps = {
  projects?: ProjectRow[];
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function ProjectsView({
  projects = [],
}: ProjectsViewProps) {
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">MANAGE</p>
        <h1>Projects</h1>
      </header>

      <div className={styles.tableContainer}>
        <table className={styles.table} aria-label="Projects">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Deadline</th>
              <th scope="col">Status</th>
              <th scope="col">Progress</th>
              <th scope="col">People</th>
            </tr>
          </thead>

          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={5}>
                  No projects yet. Create your first project.
                </td>
              </tr>
            )}

            {projects.map((project) => {
              const progress =
                project.totalTasks === 0
                  ? 0
                  : Math.round(
                      (project.completedTasks / project.totalTasks) * 100,
                    );

              return (
                <tr key={project.id}>
                  <th scope="row" className={styles.projectName}>
                    {project.name}

                    {project.overdueTasks > 0 && (
                      <span className={styles.overdue}>
                        {project.overdueTasks} overdue{" "}
                        {project.overdueTasks === 1 ? "task" : "tasks"}
                      </span>
                    )}
                  </th>

                  <td className={styles.deadline}>
                    {project.deadline ? (
                      <time dateTime={project.deadline}>
                        {dateFormatter.format(
                          new Date(`${project.deadline}T00:00:00Z`),
                        )}
                      </time>
                    ) : (
                      "No deadline"
                    )}
                  </td>

                  <td>
                    <span
                      className={`status-badge${
                        project.status === "Planned" ? " planned" : ""
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>

                  <td>
                    <div className={styles.progressCell}>
                      <div
                        className={styles.progressTrack}
                        role="progressbar"
                        aria-label={`${project.name}: completed tasks`}
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${progress}%` }} />
                      </div>

                      <span className={styles.progressValue}>
                        {progress}%
                      </span>
                    </div>
                  </td>

                  <td className={styles.people}>
                    {project.people}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}