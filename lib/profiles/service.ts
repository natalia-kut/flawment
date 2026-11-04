import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";

export class ProfileError extends Error {}
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

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

export async function updateProfile(actor: Actor, data: FormData) {
  const description = String(data.get("description") ?? "").trim();
  if (description.length > 2000) throw new ProfileError("Your description must be no longer than 2000 characters.");
  const upload = data.get("photo");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const remove = data.get("remove_photo") === "on";
  if (remove && file) throw new ProfileError("Choose either a new photo or Remove photo.");
  const photo = file ? new Uint8Array(await normalizePhoto(file)) : remove ? null : undefined;
  return prisma.user.update({
    where: { id: actor.id },
    data: { description: description || null, ...(photo !== undefined ? { photo, photo_updated_at: photo === null ? null : new Date() } : {}) },
    select: { id: true },
  });
}

export function profileVisibility(actor: Actor, userId: number) {
  return {
    id: userId, is_active: true,
    ...(actor.id === userId || actor.role === "SUPER_ADMIN" ? {} : {
      role: "USER" as const,
      memberships: { some: { project: { memberships: { some: { user_id: actor.id } } } } },
    }),
  };
}
