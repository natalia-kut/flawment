"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChatLog } from "@/components/flawiusz/chat-log";
import { Composer } from "@/components/flawiusz/composer";
import type { FlawiuszChat } from "@/components/flawiusz/use-flawiusz-chat";
import PageHeader from "@/components/page-header";
import TaskCalendar from "@/components/dashboard/task-calendar";
import ProjectTimeline from "@/components/dashboard/project-timeline";
import TeamRings from "@/components/dashboard/team-rings";
import TaskPreview from "@/components/dashboard/task-preview";
import type { TeamPerson } from "@/lib/teams/data";
import type { WorkspaceProject } from "@/lib/projects/data";
import { isTaskOverdue } from "@/lib/tasks/board";
import { taskAssigneeKey } from "@/lib/tasks/filters";
import { taskPriorityLabels } from "@/lib/tasks/labels";
import styles from "./dashboard.module.css";
import CelebrationBanner from "./celebration-banner";
import type { Celebration } from "@/lib/time-off/dates";
import type { CalendarTimeOff } from "@/lib/time-off/calendar";

const UP_NEXT = 5;
const DAY = 86_400_000;

const isOpen = (task: { status: string }) => task.status !== "COMPLETED" && task.status !== "CANCELLED";
const daysUntil = (deadline: string, today: string) => Math.round((Date.parse(deadline) - Date.parse(today)) / DAY);
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "3 days late", "Today", "Tomorrow", "In 4 days" or "12 Dec". */
function dueLabel(deadline: string, today: string) {
  if (!deadline) return "No deadline";
  const days = daysUntil(deadline, today);
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} late`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return shortDate.format(new Date(deadline + "T00:00:00Z"));
}

/** Counts up from 0 to `value` once, on first show (instantly when motion is reduced). */
function useCountUp(value: number, duration = 700) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: string }) {
  const shown = useCountUp(value);
  return <Link href={href} className={styles.stat} data-tone={tone}>
    <span className={styles.statValue} aria-hidden="true">{shown}</span>
    <span className={styles.statLabel}><span className="visually-hidden">{value} </span>{label}</span>
  </Link>;
}

/** A slowly turning sun when nothing is due or late; a warning when something is overdue; otherwise a calendar with a pulse. */
function SummaryIcon({ tone }: { tone: "free" | "late" | "due" }) {
  if (tone === "late") return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" />
  </svg>;
  return tone === "free"
    ? <svg className={styles.sun} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <g className={styles.rays}><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g>
    </svg>
    : <span className={styles.dueIcon} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
    </span>;
}

// The dashboard: Flawiusz first, the numbers that matter, deadlines, what's next, the projects over time, and the team or your progress.
export default function Dashboard({ chat, firstName, celebrations = [], workspace, onOpenTemplate }: {
  chat: FlawiuszChat;
  firstName: string;
  /** Your birthday or work anniversary, when it is today. */
  celebrations?: Celebration[];
  workspace: { projects: WorkspaceProject[]; userId: number; today: string; timeOff?: CalendarTimeOff[]; myTeam?: { name: string; members: TeamPerson[] } | null };
  onOpenTemplate: (templateId: string) => void;
}) {
  const { projects, userId, today, timeOff = [], myTeam = null } = workspace;
  const started = chat.messages.length > 0;
  // Clicking a task previews it here, so a quick look never leaves the dashboard.
  const [previewId, setPreviewId] = useState<number | null>(null);

  const tasks = projects.flatMap((project) => project.tasks.map((task) => ({
    ...task, projectId: project.id, projectName: project.name, overdue: isTaskOverdue(task, today),
  })));
  const open = tasks.filter(isOpen);
  const mine = open.filter((task) => task.assignedTo === userId);
  const activeProjects = projects.filter((project) => project.status === "IN_PROGRESS");
  const managesTasks = projects.some((project) => project.canManageTasks);
  // Whoever plans the work counts everyone's deadlines; everyone else counts their own.
  const counted = managesTasks ? open : mine;
  const overdue = counted.filter((task) => task.overdue);
  const dueThisWeek = counted.filter((task) => task.deadline && daysUntil(task.deadline, today) >= 0 && daysUntil(task.deadline, today) < 7);
  const scopeParam = managesTasks ? "" : "&mine=1";

  // Up next: your own open work first, most urgent first, then the team's soonest to fill the list.
  const byDeadline = (a: { deadline: string }, b: { deadline: string }) => (a.deadline || "9999").localeCompare(b.deadline || "9999");
  const upNext = [...mine.toSorted(byDeadline), ...open.filter((task) => task.assignedTo !== userId).toSorted(byDeadline)]
    .slice(0, UP_NEXT);

  const previewTask = tasks.find((task) => task.id === previewId);

  // Who in your team is away or celebrating today, keyed like the task assignees.
  const teamDetails = new Map(myTeam?.members.map((m) => [String(m.id), {
    availability: m.availability,
    celebratesToday: m.birthday?.inDays === 0 ? "birthday" as const : m.anniversary?.inDays === 0 ? "anniversary" as const : null,
  }]));

  // Overdue work outranks the week ahead: no sunshine while something is already late.
  const tone = overdue.length > 0 ? "late" : dueThisWeek.length === 0 ? "free" : "due";
  const summary = tone === "late"
    ? `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}${dueThisWeek.length > 0 ? ` · ${dueThisWeek.length} due this week` : ""}`
    : tone === "free" ? "Nothing due this week"
    : `${dueThisWeek.length} ${dueThisWeek.length === 1 ? "task" : "tasks"} due this week`;

  return (
    <>
      <PageHeader title={<>Welcome, {firstName}</>}
        description={<span className={styles.summary}>
          {longDay.format(new Date(today + "T00:00:00Z"))}
          <span className={styles.summaryPill} data-tone={tone}><SummaryIcon tone={tone} />{summary}</span>
        </span>} />

      {celebrations.map((celebration) => <CelebrationBanner key={celebration.kind} celebration={celebration} />)}

      {/* Flawiusz first: the dashboard starts with a question. */}
      <section className={`flawiusz-hero ${styles.assistant}${started ? " started" : ""}`} aria-labelledby="flawiusz-hero-title">
        <span className={styles.glow} aria-hidden="true"><span /><span /><span /></span>
        <div className="flawiusz-hero-intro">
          <Image className="flawiusz-hero-avatar" src="/flawiusz.png" alt="" width={68} height={68} priority />
          <div>
            <h2 id="flawiusz-hero-title">Hi, I&apos;m Flawiusz. What are we working on today?</h2>
            {!started && (
              <p className="flawiusz-hero-copy">
                Ask about your projects, deadlines and team, or let me draft a document template for you.
              </p>
            )}
          </div>
          {started && (
            <button className="secondary-button" type="button" onClick={chat.reset}>
              New chat
            </button>
          )}
        </div>
        {started && <ChatLog chat={chat} className="in-hero" onOpenTemplate={onOpenTemplate} />}
        <Composer chat={chat} placeholder="e.g. What should I focus on this week?" />
      </section>

      <div className={styles.stats}>
        <Stat label="Your open tasks" value={mine.length} href="/?view=tasks&mine=1" />
        <Stat label="Overdue" value={overdue.length} href={"/?view=tasks&overdue=1" + scopeParam} tone={overdue.length > 0 ? "critical" : undefined} />
        <Stat label="Due this week" value={dueThisWeek.length} href={"/?view=tasks" + scopeParam} />
        <Stat label="Active projects" value={activeProjects.length} href="/?view=projects" />
      </div>

      <div className={styles.columns}>
        <section className={styles.panel} aria-label="Deadlines">
          <TaskCalendar today={today} tasks={tasks.filter((task) => task.status !== "CANCELLED")} timeOff={timeOff} onOpenTask={setPreviewId} />
        </section>

        <section className={styles.panel} aria-labelledby="up-next-title">
          <div className={styles.panelHeading}>
            <h2 id="up-next-title">Up next</h2>
            <Link href="/?view=tasks">All tasks →</Link>
          </div>
          {upNext.length === 0
            ? <p className={styles.empty}>Nothing open. Enjoy the calm.</p>
            : <ul className={styles.upNext}>
              {upNext.map((task) => {
                const soon = !task.overdue && task.deadline !== "" && daysUntil(task.deadline, today) <= 1;
                return <li key={task.id}>
                  <button type="button" className={styles.task} onClick={() => setPreviewId(task.id)}>
                    <span className={styles.priority} data-priority={task.priority} title={taskPriorityLabels[task.priority] + " priority"} />
                    <span className={styles.taskText}>
                      <strong>{task.title}</strong>
                      <span>{task.projectName} · {task.assignedTo === userId ? <em className={styles.you}>You</em> : task.assigneeName}</span>
                    </span>
                    <span className={styles.due} data-state={task.overdue ? "late" : soon ? "soon" : undefined}>{dueLabel(task.deadline, today)}</span>
                  </button>
                </li>;
              })}
            </ul>}
        </section>
      </div>

      <section className={`${styles.panel} ${styles.wide}`} aria-labelledby="timeline-title">
        <div className={styles.panelHeading}><h2 id="timeline-title">Timeline</h2></div>
        <ProjectTimeline projects={projects} today={today} />
      </section>

      {/* Everyone sees their own team: who is in, who is away, how their work is going. */}
      {myTeam && <section className={`${styles.panel} ${styles.wide}`} aria-labelledby="team-title">
        <div className={styles.panelHeading}><h2 id="team-title">Your team <small className={styles.teamName}>{myTeam.name}</small></h2><Link href="/?view=team">Open team page</Link></div>
        <TeamRings currentUserKey={String(userId)} people={teamDetails}
          members={myTeam.members.map((m) => ({ key: String(m.id), name: `${m.first_name} ${m.last_name}` }))}
          tasks={tasks.map((task) => ({ status: task.status, overdue: task.overdue, assigneeKey: taskAssigneeKey(task), assigneeName: task.assigneeName }))} />
      </section>}

      {previewTask && <TaskPreview task={previewTask} onClose={() => setPreviewId(null)} />}
    </>
  );
}
