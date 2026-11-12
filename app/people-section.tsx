import { requireUser } from "@/lib/auth/session";
import { getPeopleDirectory } from "@/lib/people/data";
import PeopleView from "./people-view";

export default async function PeopleSection() {
  const user = await requireUser();
  const directory = await getPeopleDirectory(user);
  return directory ? <PeopleView directory={directory} /> : null;
}
