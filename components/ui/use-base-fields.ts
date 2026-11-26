import { useState } from "react";

/**
 * Form fields for editing a saved record that may change while the form is
 * open (a colleague's save, a drag that just finished, a refresh after a
 * conflict). Fields the person left alone follow the record; fields they are
 * editing keep their text. `base` is what the form started from: send it as
 * `expected_*` (see lib/stale.ts) so the server refuses real clashes.
 * `clashed` names the fields someone else changed while this person was
 * editing them.
 */
export function useBaseFields<T extends Record<string, string>>(saved: T, follow = true) {
  const keys = Object.keys(saved) as (keyof T & string)[];
  const [base, setBase] = useState(saved);
  const [fields, setFields] = useState(saved);
  const [clashed, setClashed] = useState<(keyof T & string)[]>([]);
  // Counts the times the record changed under the form: a key for editors that keep their own text.
  const [revision, setRevision] = useState(0);
  // Adjusted while rendering, not in an effect, so a changed record never shows stale fields for a frame.
  const savedKey = JSON.stringify(saved);
  const [seenKey, setSeenKey] = useState(savedKey);
  if (follow && savedKey !== seenKey) {
    setSeenKey(savedKey);
    const touched = keys.filter((key) => fields[key] !== base[key]);
    setFields(Object.fromEntries(keys.map((key) => [key, touched.includes(key) ? fields[key] : saved[key]])) as unknown as T);
    setBase(saved);
    setRevision((count) => count + 1);
    const clash = touched.filter((key) => saved[key] !== base[key]);
    if (clash.length) setClashed(clash);
  }
  const dirty = keys.some((key) => fields[key] !== base[key]);
  return {
    base, fields, dirty, clashed, keys, revision,
    update: (key: keyof T & string, value: string) => setFields((current) => ({ ...current, [key]: value })),
    discard: () => { setFields(base); setClashed([]); },
    clearClashed: () => setClashed([]),
  };
}
