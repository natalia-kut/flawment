/**
 * `part` of `whole` as a whole percentage for people to read. 100% means all of it
 * and 0% means none: 199 of 200 shows 99%, not 100%, and 1 of 500 shows 1%, not 0%.
 */
export function sharePercent(part: number, whole: number) {
  if (whole <= 0 || part <= 0) return 0;
  if (part >= whole) return 100;
  return Math.min(99, Math.max(1, Math.round(part / whole * 100)));
}
