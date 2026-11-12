import type { Availability } from "@/lib/time-off/availability";
import { reasonLabel } from "@/lib/time-off/labels";

/**
 * "Out of office until 20 Nov" (away now) or "Away 24 – 28 Nov" (soon), plus
 * the reason when the server decided this viewer may know it.
 */
export default function AvailabilityBadge({ availability }: { availability: NonNullable<Availability> }) {
  return <span className={`availability-badge ${availability.state}`}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      {availability.state === "away"
        ? <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        : <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>}
    </svg>
    {availability.label}
    {availability.reasons && <span className="availability-reason">· {reasonLabel(availability.reasons)}</span>}
  </span>;
}
