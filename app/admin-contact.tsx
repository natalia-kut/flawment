import type { AdministratorContact } from "@/lib/people/data";

/** Whom to ask about your account, job title or team: the administrators, with a way to write to them. */
export default function AdminContact({ administrators, compact = false }: { administrators: AdministratorContact[]; compact?: boolean }) {
  if (administrators.length === 0) return null;
  const list = <ul className="admin-contact-list">
    {administrators.map((admin) => <li key={admin.id}>
      <strong>{admin.name}</strong> <a className="inline-link" href={`mailto:${admin.email}`}>{admin.email}</a>
    </li>)}
  </ul>;
  if (compact) return <div className="admin-contact compact">
    <p>Questions about your account, job title or team? {administrators.length === 1 ? "Your administrator:" : "Your administrators:"}</p>
    {list}
  </div>;
  return <section className="workspace-card admin-contact" aria-labelledby="admin-contact-title">
    <h2 id="admin-contact-title">Need help?</h2>
    <p>Administrators set up accounts, job titles and teams. {administrators.length === 1 ? "Contact yours:" : "Contact any of them:"}</p>
    {list}
  </section>;
}
