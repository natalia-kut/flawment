import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import { isValidDay, workspaceToday } from "@/lib/time-off/dates";
import { MAX_PHOTO_BYTES, MAX_SKILLS } from "./limits";

export { MAX_PHOTO_BYTES };
export class ProfileError extends Error {}

export async function normalizePhoto(file: File) {
  if (file.size > MAX_PHOTO_BYTES) throw new ProfileError("Choose a photo no larger than 2 MB.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 16_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image");
    }
    // Decode and re-encode: strips metadata and never serves the original uploaded bytes.
    return await image.rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new ProfileError("Choose a valid, non-animated JPEG, PNG or WebP photo (up to 16 megapixels).");
  }
}

/** An empty value clears the birthday. */
function parseBirthDate(value: string, today = workspaceToday()) {
  if (!value) return null;
  if (!isValidDay(value) || value < "1900-01-01" || value > today) throw new ProfileError("Enter a valid date of birth.");
  return new Date(value);
}

const text = (label: string, max: number) => (raw: string) => {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length > max) throw new ProfileError(`${label} can be up to ${max} characters.`);
  return value || null;
};

/**
 * Contact fields edited one at a time, in place on the profile. An empty value
 * clears the field. The job title is not here: a super admin sets it.
 */
const profileFields = {
  pronouns: text("Pronouns", 30),
  phone: (raw: string) => {
    const phone = text("Phone", 30)(raw);
    if (phone && !/^\+?[\d\s()-]{6,30}$/.test(phone)) throw new ProfileError("Enter a phone number using digits, spaces, +, ( ) or -.");
    return phone;
  },
  location: text("Location", 80),
  working_hours: text("Working hours", 60),
  birth_date: (raw: string) => parseBirthDate(raw.trim()),
  skills: (raw: string) => parseSkills(raw),
};
export type ProfileField = keyof typeof profileFields;

export async function updateProfileField(actor: Actor, field: string, value: string) {
  if (!Object.hasOwn(profileFields, field)) throw new ProfileError("This detail cannot be changed here.");
  const parsed = profileFields[field as ProfileField](value);
  return prisma.user.update({ where: { id: actor.id }, data: { [field]: parsed }, select: { id: true } });
}

/** One tag per comma; duplicates differing only in letter case collapse. */
function parseSkills(raw: string) {
  const skills: string[] = [];
  for (const part of raw.split(",")) {
    const skill = part.trim().replace(/\s+/g, " ");
    if (!skill) continue;
    if (skill.length > 30) throw new ProfileError("Each skill can be up to 30 characters.");
    if (!skills.some((s) => s.toLowerCase() === skill.toLowerCase())) skills.push(skill);
  }
  if (skills.length > MAX_SKILLS) throw new ProfileError(`Add up to ${MAX_SKILLS} skills.`);
  return skills;
}

/** Uploads or removes the profile photo. Everything else on the profile saves field by field. */
export async function updateProfile(actor: Actor, data: FormData) {
  const upload = data.get("photo");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const remove = data.get("remove_photo") === "on";
  if (remove && file) throw new ProfileError("Choose either a new photo or Remove photo.");
  if (!file && !remove) throw new ProfileError("Choose a photo to upload.");
  const photo = file ? new Uint8Array(await normalizePhoto(file)) : null;
  return prisma.user.update({
    where: { id: actor.id },
    data: { photo, photo_updated_at: photo ? new Date() : null },
    select: { id: true },
  });
}

/**
 * Whose profile photo a user may see: anyone's in the company directory (every
 * active standard user). Super admins' photos stay hidden from standard users.
 */
export function profileVisibility(actor: Actor, userId: number) {
  return {
    id: userId, is_active: true,
    ...(actor.id === userId || actor.role === "SUPER_ADMIN" ? {} : { role: "USER" as const }),
  };
}
