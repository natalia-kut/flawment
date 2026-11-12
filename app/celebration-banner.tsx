"use client";

import { useState } from "react";
import { celebrate } from "@/components/ui/confetti";
import type { Celebration } from "@/lib/time-off/dates";

/** A birthday or work anniversary greeting at the top of the dashboard. Hiding it lasts until the page reloads. */
export default function CelebrationBanner({ celebration }: { celebration: Celebration }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return <section className={`celebration-banner ${celebration.kind}`} aria-label={celebration.title}>
    <button type="button" className="celebration-emoji" onClick={(e) => {
      const box = e.currentTarget.getBoundingClientRect();
      celebrate("small", { x: box.left + box.width / 2, y: box.top });
    }} aria-label="Celebrate">{celebration.emoji}</button>
    <div>
      <h2>{celebration.title}</h2>
      <p>{celebration.text}</p>
    </div>
    <button type="button" className="dialog-close" onClick={() => setHidden(true)} aria-label="Hide this message">×</button>
  </section>;
}
