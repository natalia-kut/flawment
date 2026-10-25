"use client";

import { useState, type ReactNode } from "react";
import { logout } from "@/lib/auth/actions";

const navigation = [
  "Dashboard",
  "Projects",
  "Participants",
  "Tasks",
  "Documents",
] as const;

type NavigationItem = (typeof navigation)[number];

export default function AppShell({ documents, projects, user, projectCount }: {
  documents: ReactNode; projects: ReactNode; projectCount: number;
  user: { first_name: string; last_name: string; role: string };
}) {
  const [activePage, setActivePage] = useState<NavigationItem>("Projects");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          onClick={() => setActivePage("Dashboard")}
          aria-label="Flawment home"
        >
          flawment<span>.</span>
        </a>
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
          <span className="avatar" aria-hidden="true">
            {user.first_name.slice(0, 1)}
          </span>
          <span className="profile-name">{user.first_name} {user.last_name}<small>{user.role === "SUPER_ADMIN" ? "Super admin" : "Standard user"}</small></span>
        </div>
        <form action={logout} className="logout-form"><button type="submit">Sign out</button></form>
      </aside>

      <main className="main-content">
        {activePage === "Documents" ? (
          documents
        ) : activePage === "Projects" || activePage === "Participants" ? projects : activePage === "Dashboard" ? (
          <><header className="page-header"><p className="eyebrow">WORKSPACE</p><h1>Welcome, {user.first_name}</h1></header>
          <section className="workspace-card"><h2>{projectCount} accessible projects</h2><p>Create projects and manage memberships from Projects.</p><button className="primary-button" onClick={() => setActivePage("Projects")}>Open projects</button></section></>
        ) : (
          <>
            <header className="page-header">
              <p className="eyebrow">WORKSPACE</p>
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
