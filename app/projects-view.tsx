import styles from "./projects-view.module.css";

const demoProjects = [
  {
    id: 1,
    name: "Room booking system",
    deadline: "2026-11-30",
    status: "In progress",
    completedTasks: 3,
    totalTasks: 8,
    overdueTasks: 1,
    people: 5,
  },
  {
    id: 2,
    name: "Hackathon 2027",
    deadline: "2027-03-10",
    status: "Planned",
    completedTasks: 0,
    totalTasks: 2,
    overdueTasks: 0,
    people: 2,
  },
];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function ProjectsView() {
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
            {demoProjects.map((project) => {
              const progress = project.totalTasks === 0
                ? 0
                : Math.round((project.completedTasks / project.totalTasks) * 100);

              return (
                <tr key={project.id}>
                  <th scope="row" className={styles.projectName}>
                    {project.name}
                    {project.overdueTasks > 0 && (
                      <span className={styles.overdue}>
                        {project.overdueTasks} overdue {project.overdueTasks === 1 ? "task" : "tasks"}
                      </span>
                    )}
                  </th>
                  <td className={styles.deadline}>
                    <time dateTime={project.deadline}>
                      {dateFormatter.format(new Date(`${project.deadline}T00:00:00Z`))}
                    </time>
                  </td>
                  <td>
                    <span className={`status-badge${project.status === "Planned" ? " planned" : ""}`}>
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
                      <span className={styles.progressValue}>{progress}%</span>
                    </div>
                  </td>
                  <td className={styles.people}>{project.people}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
