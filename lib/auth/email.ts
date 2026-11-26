/**
 * What counts as an email address, for the server and the form alike. The
 * browser's own `type="email"` check accepts `name@company` (no dot in the
 * domain), which the server refuses: sharing this rule lets the form say so
 * before anything is sent. Control characters are refused too, so a NUL never
 * reaches the database.
 */
const EMAIL = /^[^\s@\p{Cc}\p{Cf}]+@[^\s@\p{Cc}\p{Cf}]+\.[^\s@\p{Cc}\p{Cf}]+$/u;

export const EMAIL_RULE = "Enter a valid email address, like name@company.com";

export function isValidEmail(value: string) {
  return value.length <= 254 && EMAIL.test(value);
}
