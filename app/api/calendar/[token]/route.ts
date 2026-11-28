import { userFromToken } from "@/lib/auth/api-tokens";
import { calendarEvents } from "@/lib/calendar/feed";
import { buildCalendar } from "@/lib/calendar/ics";
import { workspaceToday } from "@/lib/time-off/dates";

/**
 * A person's calendar feed, for Google, Outlook or Apple Calendar to subscribe
 * to: /api/calendar/flw_….ics. Calendar apps send no headers of their own, so
 * the token is in the address; it must be a calendar-only token (see
 * createApiToken), and an unknown, expired or revoked one finds nothing.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  const { token } = await params;
  const user = await userFromToken(token.replace(/\.ics$/, ""), "CALENDAR");
  if (!user) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

  const origin = new URL(request.url).origin;
  const events = await calendarEvents(user, workspaceToday(), origin);
  return new Response(buildCalendar(`Flawment · ${user.first_name}`, events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="flawment.ics"',
      // Personal: no shared cache may keep it.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      // The address carries the token: do not pass it on as a referrer.
      "referrer-policy": "no-referrer",
    },
  });
}
