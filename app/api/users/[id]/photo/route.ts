import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { profileVisibility } from "@/lib/profiles/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!actor) return new Response(null, { status: 401, headers });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return new Response(null, { status: 404, headers });
  const user = await prisma.user.findFirst({ where: profileVisibility(actor, Number(id)), select: { photo: true } });
  if (!user?.photo) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(user.photo), { headers: { ...headers, "Content-Type": "image/webp" } });
}
