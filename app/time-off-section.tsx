import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { workspaceToday } from "@/lib/time-off/dates";
import TimeOffView from "./time-off-view";

const select = { id: true, type: true, start_date: true, end_date: true, note: true } as const;
const day = (date: Date) => date.toISOString().slice(0, 10);

export default async function TimeOffSection() {
  const user = await requireUser();
  const today = workspaceToday();
  const [upcoming, past] = await Promise.all([
    prisma.absence.findMany({ where: { user_id: user.id, end_date: { gte: new Date(today) } }, orderBy: { start_date: "asc" }, select }),
    prisma.absence.findMany({ where: { user_id: user.id, end_date: { lt: new Date(today) } }, orderBy: { start_date: "desc" }, take: 10, select }),
  ]);
  const plain = (rows: typeof upcoming) => rows.map((row) => ({ ...row, start_date: day(row.start_date), end_date: day(row.end_date) }));
  return <TimeOffView upcoming={plain(upcoming)} past={plain(past)} today={today} />;
}
