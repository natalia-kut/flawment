"use client";

import { useState, type ReactNode } from "react";

const navigation = [
  "Dashboard",
  "Projects",
  "Participants",
  "Tasks",
  "Documents",
] as const;

type NavigationItem = (typeof navigation)[number];

export default function AppShell({ documents }: { documents: ReactNode }) {
  const [activePage, setActivePage] = useState<NavigationItem>("Dashboard");

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
        {/* TODO(auth): Show the signed-in user's name and avatar here. */}
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">
            N
          </span>
          <span className="profile-name">User</span>
          <span className="profile-menu" aria-hidden="true">
            ···
          </span>
        </div>
      </aside>

      <main className="main-content">
        {activePage === "Documents" ? (
          documents
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
