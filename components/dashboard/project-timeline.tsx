"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectStatusLabels } from "@/lib/projects/labels";
import { taskProgress } from "@/lib/tasks/board";
import styles from "./project-timeline.module.css";

const DAY = 86_400_000;
const HIDDEN_KEY = "flawment.dashboard.timelineHidden";
const OPEN_END_DAYS = 21; // how far a project without an end date is drawn past today
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const yearLabel = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const toTime = (iso: string) => Date.parse(iso + "T00:00:00Z");
const fmt = (time: number) => dateLabel.format(new Date(time));

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

type Bar = {
  id: number; name: string; status: string; start: number; end: number; openEnded: boolean;
  late: boolean; percent: number; stages: { name: string; time: number }[];
};

/**
 * Projects on one time axis: when each runs, how far along it is, its stage
 * deadlines, and where projects overlap. Pick which projects to compare; the
 * axis fits the ones shown and the choice is remembered on this device.
 */
export default function ProjectTimeline({ projects, today }: { projects: WorkspaceProject[]; today: string }) {
  const hiddenRaw = useSyncExternalStore(subscribe, () => localStorage.getItem(HIDDEN_KEY), () => null);
  const hidden = new Set<number>(hiddenRaw ? (JSON.parse(hiddenRaw) as number[]) : projects.filter((p) => p.status === "ARCHIVED").map((p) => p.id));
  const [hover, setHover] = useState<number | null>(null);
  const now = toTime(today);

  function setHidden(next: Set<number>) {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new StorageEvent("storage", { key: HIDDEN_KEY }));
  }
  function toggle(id: number) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHidden(next);
  }

  const bars: Bar[] = projects.filter((p) => !hidden.has(p.id)).map((project) => {
    const start = toTime(project.start_date);
    const openEnded = !project.end_date;
    const end = openEnded ? Math.max(now, start) + OPEN_END_DAYS * DAY : toTime(project.end_date);
    return {
      id: project.id, name: project.name, status: project.status, start, end: Math.max(end, start + DAY), openEnded,
      late: !openEnded && end < now && project.status !== "COMPLETED" && project.status !== "CANCELLED",
      percent: taskProgress(project.tasks).percent,
      stages: project.stages.filter((stage) => stage.deadline).map((stage) => ({ name: stage.name, time: toTime(stage.deadline) })),
    };
  }).sort((a, b) => a.start - b.start);

  // The axis spans the shown projects and today, with a little air on both sides.
  const min = Math.min(now, ...bars.map((bar) => bar.start)) - 10 * DAY;
  const max = Math.max(now, ...bars.map((bar) => bar.end)) + 10 * DAY;
  const pos = (time: number) => ((time - min) / (max - min)) * 100;

  const months: number[] = [];
  for (let d = new Date(min); d.getTime() <= max; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    if (first >= min) months.push(first);
  }

  // Where two or more shown projects run at the same time.
  const edges = bars.flatMap((bar) => [{ t: bar.start, d: 1 }, { t: bar.end, d: -1 }]).sort((a, b) => a.t - b.t || a.d - b.d);
  const bands: { from: number; to: number; count: number }[] = [];
  let running = 0;
  for (let i = 0; i < edges.length; i++) {
    running += edges[i].d;
    const next = edges[i + 1];
    if (running >= 2 && next && next.t > edges[i].t) bands.push({ from: edges[i].t, to: next.t, count: running });
  }

  const overlapsWith = (bar: Bar) => bars.filter((other) => other.id !== bar.id && other.start < bar.end && bar.start < other.end)
    .map((other) => ({ name: other.name, days: Math.round((Math.min(bar.end, other.end) - Math.max(bar.start, other.start)) / DAY) }));
  const hovered = bars.find((bar) => bar.id === hover);
  const related = new Set(hovered ? bars.filter((bar) => bar.id !== hovered.id && bar.start < hovered.end && hovered.start < bar.end).map((bar) => bar.id) : []);

  return <div className={styles.timeline}>
    <div className={styles.picker} role="group" aria-label="Projects on the timeline">
      {projects.map((project) => <button key={project.id} type="button" aria-pressed={!hidden.has(project.id)}
        onClick={() => toggle(project.id)} title={project.name}>
        <span className={styles.pickDot} data-status={project.status} aria-hidden="true" />{project.name}
      </button>)}
      <span className={styles.pickerActions}>
        <button type="button" onClick={() => setHidden(new Set())}>Show all</button>
        <button type="button" onClick={() => setHidden(new Set(projects.map((p) => p.id)))}>Clear</button>
      </span>
    </div>

    {bars.length === 0 ? <p className={styles.quiet}>Pick projects above to see them on the timeline.</p> : <>
      <div className={styles.chart} onMouseLeave={() => setHover(null)}>
        <div className={styles.names}>
          <span className={styles.axisSpacer} />
          {bars.map((bar) => <span key={bar.id} className={styles.name} data-dim={hovered && hovered.id !== bar.id && !related.has(bar.id) || undefined} title={bar.name}>{bar.name}</span>)}
        </div>

        <div className={styles.plot}>
          <div className={styles.axis}>
            {months.map((month, index) => <span key={month} style={{ left: pos(month) + "%" }}>
              {index === 0 || new Date(month).getUTCMonth() === 0 ? yearLabel.format(new Date(month)) : monthLabel.format(new Date(month))}
            </span>)}
          </div>
          <div className={styles.rows}>
            {months.map((month) => <span key={month} className={styles.gridline} style={{ left: pos(month) + "%" }} aria-hidden="true" />)}
            {bands.map((band) => <span key={band.from} className={styles.band} data-strong={band.count > 2 || undefined}
              style={{ left: pos(band.from) + "%", width: pos(band.to) - pos(band.from) + "%" }} aria-hidden="true" />)}
            <span className={styles.today} style={{ left: pos(now) + "%" }}><span>Today</span></span>

            {bars.map((bar) => {
              const overlaps = overlapsWith(bar);
              return <div key={bar.id} className={styles.row}>
                <Link href={`/?project=${bar.id}`} className={styles.bar} data-status={bar.status}
                  data-late={bar.late || undefined} data-open={bar.openEnded || undefined}
                  data-dim={hovered && hovered.id !== bar.id && !related.has(bar.id) || undefined}
                  data-related={related.has(bar.id) || undefined}
                  style={{ left: pos(bar.start) + "%", width: pos(bar.end) - pos(bar.start) + "%" }}
                  onMouseEnter={() => setHover(bar.id)} onFocus={() => setHover(bar.id)} onBlur={() => setHover(null)}
                  aria-label={`${bar.name}: ${projectStatusLabels[bar.status]}, ${fmt(bar.start)} to ${bar.openEnded ? "no end date" : fmt(bar.end)}, ${bar.percent}% done${overlaps.length ? `, overlaps ${overlaps.map((o) => o.name).join(", ")}` : ""}`}>
                  <span className={styles.fill} style={{ width: bar.percent + "%" }} />
                  <span className={styles.barLabel}>{bar.percent}%</span>
                  {bar.stages.filter((stage) => stage.time >= bar.start && stage.time <= bar.end).map((stage) =>
                    <span key={stage.name} className={styles.milestone} title={`${stage.name} · ${fmt(stage.time)}`}
                      style={{ left: ((stage.time - bar.start) / (bar.end - bar.start)) * 100 + "%" }} />)}
                </Link>
                {hover === bar.id && <span className={styles.tooltip} role="tooltip"
                  style={{ left: Math.min(82, Math.max(18, pos((bar.start + bar.end) / 2))) + "%" }}>
                  <strong>{bar.name}</strong>
                  <span>{fmt(bar.start)} – {bar.openEnded ? "no end date" : fmt(bar.end)} · {bar.percent}% done{bar.late ? " · past its end" : ""}</span>
                  {overlaps.length > 0 && <span>Overlaps {overlaps.map((o) => `${o.name} (${o.days} d)`).join(", ")}</span>}
                </span>}
              </div>;
            })}
          </div>
        </div>
      </div>

      <ul className={styles.key}>
        <li><span className={styles.keyBar} />Done so far</li>
        <li><span className={styles.keyBand} />Projects overlap</li>
        <li><span className={styles.keyMilestone} />Stage deadline</li>
        <li><span className={styles.keyOpen} />No end date</li>
      </ul>
    </>}
  </div>;
}
