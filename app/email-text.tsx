/**
 * An email address that, when it has to wrap, breaks only after the "@"
 * ("aleksandra.lewandowska@" / "flawment.dev"), never mid-word or cut off.
 */
export default function EmailText({ email }: { email: string }) {
  const at = email.lastIndexOf("@");
  if (at < 0) return <>{email}</>;
  return <>{email.slice(0, at + 1)}<wbr />{email.slice(at + 1)}</>;
}
