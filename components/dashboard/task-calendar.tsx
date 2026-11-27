"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { taskStatusLabels } from "@/lib/tasks/labels";
import styles from "./dashboard-widgets.module.css";
import type { CalendarTimeOff } from "@/lib/time-off/calendar";
import { absenceTypeLabels } from "@/lib/time-off/labels";
import { formatRange } from "@/lib/time-off/dates";

export type CalendarTask = {
  id: number; title: string; deadline: string; status: string; overdue: boolean;
  projectId: number; projectName: string; assigneeName: string;
};

const MAX_DOTS = 3;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const weekdayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/**
 * A month of deadlines: each day shows a dot per task due, coloured by status,
 * and picking a day lists its tasks. Weeks start on Monday.
 * Time off shows too: your own days are striped in the colour of their type,
 * and a team lead sees a moon with how many of their team are away.
 */
export default function TaskCalendar({ tasks, today, timeOff = [], onOpenTask }: {
  tasks: CalendarTask[]; today: string; timeOff?: CalendarTimeOff[]; onOpenTask: (id: number) => void;
}) {
  const offOn = (date: string) => timeOff.filter((entry) => entry.start <= date && entry.end >= date);
  const [year, month] = today.split("-").map(Number);
  const [shown, setShown] = useState({ year, month: month - 1 });
  const [selected, setSelected] = useState(today);

  const byDay = new Map<string, CalendarTask[]>();
  for (const task of tasks) {
    if (!task.deadline) continue;
    byDay.set(task.deadline, [...(byDay.get(task.deadline) ?? []), task]);
  }

  const first = new Date(Date.UTC(shown.year, shown.month, 1));
  const daysInMonth = new Date(Date.UTC(shown.year, shown.month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // One tab stop for the whole month: the selected day (or the 1st when it is in another month).
  // Arrow keys, Home and End move between days, across months too.
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const tabbable = selected.startsWith(iso(shown.year, shown.month, 1).slice(0, 7)) ? selected : iso(shown.year, shown.month, 1);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, shown]);
  function onGridKeyDown(event: KeyboardEvent) {
    const shift = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    const current = new Date(tabbable + "T00:00:00Z");
    const weekday = (current.getUTCDay() + 6) % 7;
    const days = shift ?? (event.key === "Home" ? -weekday : event.key === "End" ? 6 - weekday : null);
    if (days === null || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    current.setUTCDate(current.getUTCDate() + days);
    const next = current.toISOString().slice(0, 10);
    moved.current = true;
    setSelected(next);
    setShown({ year: current.getUTCFullYear(), month: current.getUTCMonth() });
  }

  function step(delta: number) {
    setShown(({ year: y, month: m }) => {
      const next = new Date(Date.UTC(y, m + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  const selectedTasks = byDay.get(selected) ?? [];
  const selectedOff = offOn(selected).sort((a, b) => Number(b.mine) - Number(a.mine));

  return <div className={styles.calendar}>
    <div>
      <div className={styles.calendarHead}>
        <button type="button" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <strong aria-live="polite">{monthName.format(first)}</strong>
        <button type="button" onClick={() => step(1)} aria-label="Next month">›</button>
        {(shown.year !== year || shown.month !== month - 1) &&
          <button type="button" className={styles.todayButton} onClick={() => { setShown({ year, month: month - 1 }); setSelected(today); }}>Today</button>}
      </div>
      {/* A group of day buttons, not an ARIA grid: a grid needs rows, which this layout does not have. */}
      <div className={styles.grid} role="group" aria-label={"Deadlines in " + monthName.format(first) + ". Use the arrow keys to move between days."}
        ref={grid} onKeyDown={onGridKeyDown}>
        {WEEKDAYS.map((day) => <span key={day} className={styles.weekday} aria-hidden="true">{day}</span>)}
        {cells.map((day, index) => {
          if (day === null) return <span key={"empty-" + index} />;
          const date = iso(shown.year, shown.month, day);
          const due = byDay.get(date) ?? [];
          const late = due.some((task) => task.overdue);
          const off = offOn(date);
          const mine = off.find((entry) => entry.mine);
          const others = off.filter((entry) => !entry.mine).length;
          const offLabel = [mine && `you are off (${absenceTypeLabels[mine.type]})`, others && `${others} of your team away`].filter(Boolean).join(", ");
          return <button key={date} type="button" className={styles.day} data-date={date} tabIndex={date === tabbable ? 0 : -1}
            data-today={date === today || undefined} data-selected={date === selected || undefined} data-late={late || undefined}
            data-off={mine ? mine.type : undefined}
            // The name starts with the visible number, so voice control ("click 12") finds it.
            aria-pressed={date === selected} aria-label={`${day}, ${weekdayName.format(new Date(date + "T00:00:00Z"))}: ${due.length} ${due.length === 1 ? "task" : "tasks"} due${offLabel ? `; ${offLabel}` : ""}`}
            onClick={() => setSelected(date)}>
            {others > 0 && <span className={styles.teamOff} aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>{others}
            </span>}
            <span className={styles.dayNumber}>{day}</span>
            {due.length > 0 && <span className={styles.dots} aria-hidden="true">
              {due.slice(0, MAX_DOTS).map((task) => <span key={task.id} className={styles.dot} data-status={task.status} />)}
              {due.length > MAX_DOTS && <span className={styles.more}>+{due.length - MAX_DOTS}</span>}
            </span>}
          </button>;
        })}
      </div>
    </div>

    <div className={styles.dayPanel} aria-live="polite">
      <h3>{selected === today ? "Today" : dayName.format(new Date(selected + "T00:00:00Z"))}</h3>
      {selectedOff.length > 0 && <ul className={styles.offList} aria-label="Time off">
        {selectedOff.map((entry) => <li key={entry.id} data-off={entry.type}>
          <strong>{entry.mine ? "You" : entry.name}</strong>
          <span>{absenceTypeLabels[entry.type]} · {formatRange(entry.start, entry.end)}</span>
        </li>)}
      </ul>}
      {selectedTasks.length === 0
        ? <p className={styles.quiet}>Nothing due{selected === today ? " today" : " this day"}.</p>
        : <ul>
          {selectedTasks.map((task) => <li key={task.id}>
            <button type="button" onClick={() => onOpenTask(task.id)}>
              <span className={styles.dot} data-status={task.status} aria-hidden="true" />
              <span className={styles.dayTask}>
                <strong>{task.title}</strong>
                <span>{task.projectName} · {task.assigneeName}</span>
              </span>
              <span className={styles.dayStatus} data-late={task.overdue || undefined}>
                {task.overdue ? "Overdue" : taskStatusLabels[task.status]}
              </span>
            </button>
          </li>)}
        </ul>}
    </div>
  </div>;
}
