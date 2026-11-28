import { currentUser } from "@/lib/auth/session";
import { getNotifications } from "@/lib/notifications/data";

/** The bell's list and unread count, fetched when it opens and every so often while the app is in view. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in to see notifications." }, { status: 401 });
  return Response.json(await getNotifications(user), { headers: { "cache-control": "no-store" } });
}
