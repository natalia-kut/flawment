import { requireUser } from "@/lib/auth/session";
import type { TeamsOverview } from "@/lib/teams/data";
import { getPeopleDirectory } from "@/lib/people/data";
import TeamView from "./team-view";

/** `overview` comes from the page, which also uses it for the dashboard. */
export default async function TeamSection({ overview }: { overview: TeamsOverview }) {
  const user = await requireUser();
  // A super admin also gets account details, to set up new hires from the Teams page.
  const directory = await getPeopleDirectory(user);
  return <TeamView overview={overview} directory={directory} currentUserId={user.id} />;
}
