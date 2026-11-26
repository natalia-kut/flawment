/*
 * Saving from a page that may be out of date. A form sends, next to each
 * field, the value it started from (`expected_name`, …). Then:
 *  - a field the person left alone keeps whatever is saved now, so a
 *    colleague's newer value survives an edit of something else;
 *  - a field they changed is refused if someone else changed it first, so
 *    nobody's work is replaced without them knowing.
 * Forms that send no `expected_*` values save as before.
 */
const read = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
type Same = (key: string, a: string, b: string) => boolean;
const equal: Same = (_key, a, b) => a === b;

function changedHere(data: FormData, key: string, same: Same) {
  return data.has(key) && data.has("expected_" + key) && !same(key, read(data, key), read(data, "expected_" + key));
}

/** The fields this form changed that someone else had changed first. */
export function staleFields(data: FormData, current: Record<string, string>, same: Same = equal) {
  return Object.keys(current).filter((key) => changedHere(data, key, same) && !same(key, current[key], read(data, "expected_" + key)));
}

/** True when the form says where it started from. */
export function knowsBase(data: FormData, keys: string[]) {
  return keys.some((key) => data.has("expected_" + key));
}

/** The form with every field it left alone replaced by the value saved now. */
export function keepUnchanged(data: FormData, current: Record<string, string>, same: Same = equal) {
  const merged = new FormData();
  for (const [key, value] of data) merged.append(key, value);
  for (const key of Object.keys(current)) if (data.has("expected_" + key) && !changedHere(data, key, same)) merged.set(key, current[key]);
  return merged;
}

/** "the title, priority and deadline" */
export function listFields(names: string[]) {
  return names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names.at(-1);
}
