/**
 * What a first or last name may contain: letters from any alphabet (Łucja,
 * José, Zoë), joined by a single hyphen, apostrophe or space between parts
 * (Nowak-Kowalska, O'Brien, Anna Maria). No digits or other symbols.
 *
 * Written once as a pattern string, so the server (a RegExp) and the form (the
 * input's `pattern` attribute, which browsers read with the `v` flag) apply the
 * very same rule. `\p{M}` keeps letters typed with combining accents.
 */
export const NAME_PATTERN = "[\\p{L}\\p{M}]+(?:[ '’\\-][\\p{L}\\p{M}]+)*";

const NAME = new RegExp(`^${NAME_PATTERN}$`, "u");

export const NAME_RULE = "Letters, hyphens, apostrophes and spaces only";

export function isValidName(value: string) {
  return value.length <= 80 && NAME.test(value);
}
