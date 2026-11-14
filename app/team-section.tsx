import { requireUser } from "@/lib/auth/session";
import type { TeamsOverview } from "@/lib/teams/data";
import { getPromotions, type LeadTitleRequests } from "@/lib/job-title-requests/data";
import { getPeopleDirectory } from "@/lib/people/data";
import { prisma } from "@/lib/prisma";
import { workspaceToday } from "@/lib/time-off/dates";
import TeamView from "./team-view";

/** `overview` and `titleRequests` come from the page, which also uses them for the dashboard. */
export default async function TeamSection({ overview, titleRequests }: { overview: TeamsOverview; titleRequests: LeadTitleRequests["byPerson"] }) {
  const user = await requireUser();
  // A super admin also gets account details, to set up new hires from the Teams page.
  const directory = await getPeopleDirectory(user);
  // A team lead suggests job titles for their people, from the list or a new one.
  const leads = overview.people.some((p) => p.id === user.id && p.teamLead);
  const lead = leads ? { requests: titleRequests, jobTitles: await prisma.jobTitle.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) } : null;
  const today = workspaceToday();
  return <TeamView overview={overview} directory={directory} currentUserId={user.id} lead={lead} month={today.slice(0, 7)} promotions={await getPromotions(today)} />;
}
