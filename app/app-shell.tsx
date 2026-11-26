"use client";

import { useState, useTransition, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import SessionWatch from "./session-watch";
import { useRouter, useSearchParams } from "next/navigation";
import AccountMenu from "./account-menu";
import type { Availability } from "@/lib/time-off/availability";
import type { Status } from "@/lib/status/status";
import type { Celebration } from "@/lib/time-off/dates";
import Dashboard from "./dashboard";
import { FlawiuszPanel } from "@/components/flawiusz/panel";
import { useFlawiuszChat } from "@/components/flawiusz/use-flawiusz-chat";
import { RequestedTemplateContext } from "@/components/documents/requested-template-context";
import { SIDEBAR_COOKIE } from "@/lib/ui/sidebar";
import PageHeader from "@/components/page-header";
import { ConfirmProvider } from "@/components/ui/confirm";
import { PeopleProvider } from "./people-context";
import { confirmLeave } from "@/components/ui/unsaved";

const navigation = [
  "Dashboard",
  "Projects",
  "Team",
  "Tasks",
  "Documents",
  "People",
] as const;

type NavigationItem = (typeof navigation)[number];
/** Pages opened from the account menu rather than the main navigation. */
const accountViews = ["profile", "time-off"] as const;
type AccountView = (typeof accountViews)[number];

// Simple line icons, so the collapsed sidebar can still show where each link goes.
const navIcons: Record<NavigationItem, ReactNode> = {
  Dashboard: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z" />,
  Projects: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  Team: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.6M17.5 14a5 5 0 0 1 3 5" /></>,
  Tasks: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.2 2.3 2.3 4.7-5" /></>,
  Documents: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  People: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><circle cx="12" cy="10" r="2.8" /><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0" /></>,
};

/** Pages only a super admin sees. */
const adminOnly: readonly NavigationItem[] = ["People"];

export default function AppShell({ documents, projects, tasks, task, profile, team, timeOff, people, directory, user, workspace, sidebarCollapsed = false }: {
  documents: ReactNode; projects: ReactNode; tasks: ReactNode; /** The task a link opened, if any. */ task: ReactNode; profile: ReactNode; team: ReactNode; timeOff: ReactNode; people: ReactNode; sidebarCollapsed?: boolean;
  /** Everyone whose profile can be opened, and the teams they are in. */
  directory: Pick<ComponentProps<typeof PeopleProvider>, "people" | "teams">;
  /** What the dashboard summarises: the projects (with tasks) this user can see. */
  workspace: ComponentProps<typeof Dashboard>["workspace"];
  user: { id: number; first_name: string; last_name: string; role: string; photoVersion: string | null; availability: Availability; status: Status | null; celebrations: Celebration[] };
}) {
  const router = useRouter();
  const search = useSearchParams();
  // A project or task link has no view of its own: they live under Projects and Tasks.
  const visibleNavigation = navigation.filter((item) => user.role === "SUPER_ADMIN" || !adminOnly.includes(item));
  const view = search.get("view") ?? "";
  const accountView = (accountViews as readonly string[]).includes(view) && !search.has("project") && !search.has("task") ? view as AccountView : null;
  const activePage: NavigationItem | null = accountView ? null : search.has("project")
    ? "Projects"
    : search.has("task") ? "Tasks"
    : visibleNavigation.find((item) => item.toLowerCase() === view) ?? "Dashboard";
  const [chatOpen, setChatOpen] = useState(false);
  const [requestedTemplateId, setRequestedTemplateId] = useState<string | null>(null);
  const chat = useFlawiuszChat();
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  // A view comes from the server, which takes a moment: the clicked item is marked at once,
  // and the page shows it is loading, instead of nothing happening until it arrives.
  const [navigating, startNavigation] = useTransition();
  const [requestedPage, setRequestedPage] = useState<NavigationItem | AccountView | null>(null);
  const shownPage = navigating && requestedPage ? requestedPage : activePage;

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie (not localStorage) so the server renders the right width on the next load.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  function setActivePage(item: NavigationItem | AccountView) {
    const params = new URLSearchParams(search.toString());
    // Links into a view (a project or task page, a filtered Tasks board) do not carry over to other views.
    for (const key of ["project", "task", "in", "overdue", "mine", "team", "tab"]) params.delete(key);
    if (item === "Dashboard") params.delete("view");
    else params.set("view", item.toLowerCase());
    // Unsaved work on the page (a description being edited, a dialog with changes) asks first.
    void confirmLeave().then((ok) => {
      if (!ok) return;
      setRequestedPage(item);
      startNavigation(() => router.push(params.size ? "/?" + params.toString() : "/"));
    });
  }

  function openTemplate(templateId: string) {
    setRequestedTemplateId(templateId);
    setActivePage("Documents");
    setChatOpen(false);
  }

  return (
    <ConfirmProvider>
    <PeopleProvider people={directory.people} teams={directory.teams} currentUserId={user.id}>
    <SessionWatch userId={user.id} statusEnds={[user.status?.until ?? null, ...directory.people.map((person) => person.status?.until ?? null)]} />
    <div className="app-shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link
            className="brand"
            href="/"
            aria-label="Flawment home"
          >
            <span className="brand-full">flawment</span><span className="brand-short" aria-hidden="true">f</span><span className="brand-dot">.</span>
          </Link>
          <button type="button" className="sidebar-toggle" onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></svg>
          </button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {visibleNavigation.map((item) => (
            <button
              className={`nav-link${shownPage === item ? " active" : ""}`}
              key={item}
              type="button"
              onClick={() => setActivePage(item)}
              aria-current={shownPage === item ? "page" : undefined}
              aria-label={collapsed ? item : undefined}
              title={collapsed ? item : undefined}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{navIcons[item]}</svg>
              <span className="sidebar-label">{item}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <AccountMenu user={user} compact={collapsed} onOpen={setActivePage} />
        </div>
      </aside>

      <main className="main-content" aria-busy={navigating || undefined} data-navigating={navigating || undefined}>
        {accountView === "profile" ? profile : accountView === "time-off" ? timeOff : activePage === "Team" ? team : activePage === "People" ? people : activePage === "Documents" ? (
          // Remount when Flawiusz asks to open a template, so the page selects it.
          <RequestedTemplateContext value={requestedTemplateId} key={requestedTemplateId ?? "documents"}>
            {documents}
          </RequestedTemplateContext>
        ) : activePage === "Tasks" ? (search.has("task") ? task : tasks) : activePage === "Projects" ? projects : activePage === "Dashboard" ? (
          <Dashboard
            chat={chat}
            firstName={user.first_name}
            celebrations={user.celebrations}
            workspace={workspace}
            onOpenTemplate={openTemplate}
          />
        ) : (
          <>
            <PageHeader title="Page not found" />
            <section className="placeholder-panel"><h2>This page does not exist</h2></section>
          </>
        )}
      </main>

      {/* The dashboard has Flawiusz built in; other pages get the side panel. */}
      {activePage !== "Dashboard" && (
        <FlawiuszPanel chat={chat} onOpenChange={setChatOpen} onOpenTemplate={openTemplate} open={chatOpen} />
      )}
    </div>
    </PeopleProvider>
    </ConfirmProvider>
  );
}
