"use client";

import { useEffect, useState } from "react";
import ProgressBar from "@/components/ui/progress-bar";
import styles from "./dashboard-widgets.module.css";

export type ProgressTask = { status: string; projectId: number; projectName: string };

const R = 54;
const C = 2 * Math.PI * R;

/**
 * Your own progress, for people who do the work rather than plan it: one ring
 * for everything assigned to you, then a bar per project you have tasks in.
 */
export default function MyProgress({ tasks }: { tasks: ProgressTask[] }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(frame); }, []);

  const counted = tasks.filter((task) => task.status !== "CANCELLED");
  const done = counted.filter((task) => task.status === "COMPLETED").length;
  const share = counted.length ? done / counted.length : 0;

  const byProject = new Map<number, { name: string; done: number; total: number }>();
  for (const task of counted) {
    const entry = byProject.get(task.projectId) ?? { name: task.projectName, done: 0, total: 0 };
    entry.total += 1;
    if (task.status === "COMPLETED") entry.done += 1;
    byProject.set(task.projectId, entry);
  }

  if (counted.length === 0) return <p className={styles.quiet}>Nothing is assigned to you yet.</p>;

  return <div className={styles.myProgress}>
    <svg viewBox="0 0 140 140" className={styles.bigRing} role="img" aria-label={`${done} of ${counted.length} of your tasks done`}>
      <circle cx="70" cy="70" r={R} className={styles.bigRingTrack} />
      <circle cx="70" cy="70" r={R} className={styles.bigRingFill} data-empty={!drawn || share === 0 || undefined}
        strokeDasharray={`${drawn ? share * C : 0} ${C}`} transform="rotate(-90 70 70)" />
      <text x="70" y="70" textAnchor="middle" className={styles.donutValue}>{Math.round(share * 100)}%</text>
      <text x="70" y="90" textAnchor="middle" className={styles.donutLabel}>{done} of {counted.length} done</text>
    </svg>
    <ul className={styles.myProjects}>
      {[...byProject.entries()].map(([id, project]) => <li key={id}>
        <span title={project.name}>{project.name}</span>
        <ProgressBar label={project.name} percent={Math.round((project.done / project.total) * 100)} caption={`${project.done}/${project.total}`} />
      </li>)}
    </ul>
  </div>;
}
