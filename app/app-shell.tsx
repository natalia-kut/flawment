"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/lib/auth/actions";
import Dashboard from "./dashboard";
import { FlawiuszPanel } from "@/components/flawiusz/panel";
import { useFlawiuszChat } from "@/components/flawiusz/use-flawiusz-chat";
import { RequestedTemplateContext } from "@/components/documents/requested-template-context";

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
  // A project link has no view of its own: project details live under Projects.
  const activePage = search.has("project")
    ? "Projects"
    : navigation.find((item) => item.toLowerCase() === search.get("view")) ?? "Dashboard";
  const [chatOpen, setChatOpen] = useState(false);
  const [requestedTemplateId, setRequestedTemplateId] = useState<string | null>(null);
  const chat = useFlawiuszChat();

  function setActivePage(item: NavigationItem) {
    const params = new URLSearchParams(search.toString());
    params.delete("project");
    if (item === "Dashboard") params.delete("view");
    else params.set("view", item.toLowerCase());
    router.push(params.size ? "/?" + params.toString() : "/");
  }

  function openTemplate(templateId: string) {
    setRequestedTemplateId(templateId);
    setActivePage("Documents");
    setChatOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          className="brand"
          href="/"
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
          // Remount when Flawiusz asks to open a template, so the page selects it.
          <RequestedTemplateContext value={requestedTemplateId} key={requestedTemplateId ?? "documents"}>
            {documents}
          </RequestedTemplateContext>
        ) : activePage === "Tasks" ? tasks : activePage === "Projects" ? projects : activePage === "Dashboard" ? (
          <Dashboard
            chat={chat}
            firstName={user.first_name}
            projectCount={projectCount}
            onOpenProjects={() => setActivePage("Projects")}
            onOpenTemplate={openTemplate}
          />
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

      {/* The dashboard has Flawiusz built in; other pages get the side panel. */}
      {activePage !== "Dashboard" && (
        <FlawiuszPanel chat={chat} onOpenChange={setChatOpen} onOpenTemplate={openTemplate} open={chatOpen} />
      )}
    </div>
  );
}
