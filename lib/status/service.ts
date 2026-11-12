import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import { clearAfterOptions, statusExpiry, type ClearAfter } from "./status";

export class StatusError extends Error {}

/** Set or clear the actor's own status. An empty emoji and text clears it. */
export async function setStatus(actor: Actor, data: FormData, now = new Date()) {
  if (data.get("operation") === "clear") {
    return prisma.user.update({ where: { id: actor.id }, data: { status_emoji: null, status_text: null, status_expires_at: null }, select: { id: true } });
  }
  const text = String(data.get("text") ?? "").trim().replace(/\s+/g, " ");
  const emoji = String(data.get("emoji") ?? "").trim();
  const clearAfter = String(data.get("clear_after") ?? "never") as ClearAfter;
  if (text.length > 80) throw new StatusError("Keep your status under 80 characters.");
  // One emoji, possibly built from several code points (flags, skin tones, ZWJ sequences).
  if ([...new Intl.Segmenter().segment(emoji)].length > 1 || emoji.length > 16) throw new StatusError("Choose a single emoji.");
  if (!Object.hasOwn(clearAfterOptions, clearAfter)) throw new StatusError("Choose when to clear your status.");
  if (!text && !emoji) throw new StatusError("Write a status or pick an emoji.");
  return prisma.user.update({
    where: { id: actor.id },
    data: { status_emoji: emoji || null, status_text: text || null, status_expires_at: statusExpiry(clearAfter, now) },
    select: { id: true },
  });
}
