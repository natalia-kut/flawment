import type { Insight } from "@/lib/documents/insights";

/** Findings as short sentences; the colour only repeats what the words say. */
export default function DocumentNotes({ insights, empty }: { insights: Insight[]; empty: string }) {
  if (insights.length === 0) return <ul className="document-notes"><li data-tone="good">{empty}</li></ul>;
  return (
    <ul className="document-notes">
      {insights.map(({ key, tone, subject, text }) => (
        <li data-tone={tone} key={key}><strong>{subject}</strong> {text}</li>
      ))}
    </ul>
  );
}
