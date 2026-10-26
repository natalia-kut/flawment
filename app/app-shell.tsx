"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/lib/auth/actions";

const navigation = [
  "Dashboard",
  "Projects",
  "Team",
  "Tasks",
  "Documents",
] as const;

type NavigationItem = (typeof navigation)[number];

function SignOut() {
  const [, action, pending] = useActionState(logout, undefined);
  return <form action={action} className="logout-form">
    <button type="submit" disabled={pending}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h10" /></svg>
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  </form>;
}

export default function AppShell({ documents, projects, tasks, user, projectCount }: {
  documents: ReactNode; projects: ReactNode; tasks: ReactNode; projectCount: number;
  user: { first_name: string; last_name: string; role: string };
}) {
  const router = useRouter();
  const search = useSearchParams();
  const activePage = navigation.find((item) => item.toLowerCase() === search.get("view")) ?? "Projects";
  function setActivePage(item: NavigationItem) {
    const params = new URLSearchParams(search.toString());
    params.delete("project");
    if (item === "Projects") params.delete("view");
    else params.set("view", item.toLowerCase());
    router.push(params.size ? "/?" + params.toString() : "/");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          className="brand"
          href="/?view=dashboard"
          aria-label="Flawment home"
        >
          flawment<span>.</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-link${activePage === item ? " active" : ""}`}
              key={item}
              type="button"
              onClick={() => setActivePage(item)}
              aria-current={activePage === item ? "page" : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-profile">
          <span className="avatar" aria-hidden="true">
            {user.first_name.slice(0, 1)}
          </span>
          <span className="profile-name">{user.first_name} {user.last_name}<small>{user.role === "SUPER_ADMIN" ? "Super admin" : "Standard user"}</small></span>
          </div>
          <SignOut />
        </div>
      </aside>

      <main className="main-content">
        {activePage === "Documents" ? (
          documents
        ) : activePage === "Tasks" ? tasks : activePage === "Projects" ? projects : activePage === "Dashboard" ? (
          <><header className="page-header"><h1>Welcome, {user.first_name}</h1></header>
          <section className="workspace-card"><h2>{projectCount} accessible projects</h2><p>Create projects and manage memberships from Projects.</p><button className="primary-button" onClick={() => setActivePage("Projects")}>Open projects</button></section></>
        ) : (
          <>
            <header className="page-header">
              <h1>{activePage}</h1>
            </header>
            <section className="placeholder-panel">
              <div className="placeholder-mark" aria-hidden="true">
                {activePage.slice(0, 1)}
              </div>
              <h2>{activePage} will live here</h2>
              <p>
                This section is ready for your {activePage.toLowerCase()} overview.
                Its content can be connected as the app takes shape.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
