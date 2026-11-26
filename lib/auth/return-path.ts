/**
 * Where to go after signing in: the page that sent the person to /login, so a
 * shared task link (`/?task=12`) still opens that task. Only paths on this
 * site are kept; anything else (`//evil.test`, `https://…`, `/\evil.test`)
 * falls back to the dashboard, so the parameter cannot send anyone away.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  // The auth pages themselves would only loop back to the form.
  if (/^\/(login|register)(?:[/?#]|$)/.test(value)) return "/";
  return value;
}

/** The /login or /register address that returns to `path` afterwards. */
export function authHref(page: "/login" | "/register", path: string) {
  const next = safeReturnPath(path);
  return next === "/" ? page : `${page}?next=${encodeURIComponent(next)}`;
}
