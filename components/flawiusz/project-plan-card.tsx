import Link from "next/link";
import type { ChatProjectPlan } from "./use-flawiusz-chat";

export function ProjectPlanCard({ draft, onCreate, onOpen }: { draft: ChatProjectPlan; onCreate: () => void; onOpen?: () => void }) {
  const { plan, people } = draft;
  return <section className="flawiusz-project-plan">
    <h3>{plan.name}</h3>
    {plan.description && <p>{plan.description}</p>}
    <p>Starts {plan.start_date}{plan.end_date ? ` · Ends ${plan.end_date}` : ""}</p>
    {people.length > 0 && <p>Assignees joining as contributors (except the owner): {people.map((person) => person.name).join(", ")}</p>}
    <details>
      <summary>{plan.tasks.length} {plan.tasks.length === 1 ? "task" : "tasks"} to review</summary>
      <ol>{plan.tasks.map((task, index) => <li key={index}>
        <strong>{task.title}</strong>
        {task.description && <p>{task.description}</p>}
        <p>{people.find((person) => person.id === task.assignee_id)?.name ?? "Unassigned"} · {task.priority.toLowerCase()} priority
          {task.deadline ? ` · Due ${task.deadline}` : ""}</p>
        {task.work_from && task.work_to && <p>Planned work: {task.work_from} to {task.work_to}</p>}
      </li>)}</ol>
    </details>
    {draft.error && <p role="alert" className="flawiusz-error">{draft.error}</p>}
    {draft.savedId
      ? <Link className="secondary-button" href={`/?project=${draft.savedId}`} onNavigate={onOpen}>Open project</Link>
      : <button type="button" className="primary-button" disabled={draft.saving} onClick={onCreate}>{draft.saving ? "Creating…" : "Create project"}</button>}
  </section>;
}
