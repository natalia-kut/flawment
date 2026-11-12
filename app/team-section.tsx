import { requireUser } from "@/lib/auth/session";
import { getTeamsOverview } from "@/lib/teams/data";
import { workspaceToday } from "@/lib/time-off/dates";
import TeamView from "./team-view";

export default async function TeamSection() {
  const user = await requireUser();
  return <TeamView overview={await getTeamsOverview(user, workspaceToday())} currentUserId={user.id} />;
}
