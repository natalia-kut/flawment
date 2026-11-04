import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import ProfileView from "./profile-view";

export default async function ProfileSection() {
  const actor = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: {
    id: true, first_name: true, last_name: true, username: true, email: true, description: true,
  } });
  return <ProfileView user={{ ...user, photoVersion: actor.photoVersion }} />;
}
