import "dotenv/config";
import { readFileSync } from "node:fs";
import { hashPassword } from "../lib/auth/password";
import { isManagerialTitle } from "../lib/people/job-titles";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { AbsenceType, ProjectRole, ProjectStatus, TaskPriority, TaskStatus } from "../src/generated/prisma/enums";

// Sample workspace data. Dates are relative to the day the seed runs, so overdue
// and upcoming sections in generated documents always have something to show.
// Run with `npx prisma db seed`; it skips samples when standard users already exist.

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function day(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

const users = [
  ["natalia.kwiatek", "Natalia", "Kwiatek"],
  ["jakub.nowak", "Jakub", "Nowak"],
  ["zofia.wisniewska", "Zofia", "Wiśniewska"],
  ["michal.zielinski", "Michał", "Zieliński"],
  ["aleksandra.lewandowska", "Aleksandra", "Lewandowska"],
  ["piotr.kaminski", "Piotr", "Kamiński"],
  ["julia.dabrowska", "Julia", "Dąbrowska"],
  ["tomasz.wojcik", "Tomasz", "Wójcik"],
] as const;

type Username = (typeof users)[number][0];

// [title, assignee, deadline offset in days, status, priority, description?]
type TaskSeed = [string, Username | null, number | null, TaskStatus, TaskPriority, string?];

type ProjectSeed = {
  name: string;
  description: string;
  status: ProjectStatus;
  start: number;
  end: number | null;
  owner: Username;
  members: [Username, ProjectRole, number][];
  tasks: TaskSeed[];
};

const projects: ProjectSeed[] = [
  {
    name: "Customer self-service portal",
    description:
      "B2B portal where customers place orders, download invoices and track support tickets, replacing ordering by email.",
    status: "IN_PROGRESS",
    start: -62,
    end: 38,
    owner: "natalia.kwiatek",
    members: [
      ["natalia.kwiatek", "OWNER", -62],
      ["jakub.nowak", "COORDINATOR", -60],
      ["zofia.wisniewska", "CONTRIBUTOR", -58],
      ["michal.zielinski", "CONTRIBUTOR", -55],
      ["aleksandra.lewandowska", "CONTRIBUTOR", -40],
    ],
    tasks: [
      ["Run discovery workshops with key account managers", "natalia.kwiatek", -45, "COMPLETED", "MEDIUM", "Five workshops with sales and customer service."],
      ["Define order approval and credit limit rules", "jakub.nowak", -35, "COMPLETED", "HIGH"],
      ["Design the database schema", "michal.zielinski", -30, "COMPLETED", "HIGH"],
      ["Design order flow wireframes", "zofia.wisniewska", -20, "COMPLETED", "MEDIUM"],
      ["Set up the CI/CD pipeline", "michal.zielinski", -18, "COMPLETED", "LOW"],
      ["Build order history and invoice view", "michal.zielinski", -4, "IN_PROGRESS", "URGENT", "Filters by date, status and invoice number."],
      ["Implement the order approval workflow", "aleksandra.lewandowska", -2, "IN_PROGRESS", "HIGH"],
      ["Visual design of the product catalogue", "zofia.wisniewska", 3, "IN_REVIEW", "MEDIUM"],
      ["Email notifications for shipped orders", "aleksandra.lewandowska", 6, "TO_DO", "MEDIUM"],
      ["Product search and filters", "michal.zielinski", 9, "IN_REVIEW", "MEDIUM"],
      ["Single sign-on with the corporate identity provider", null, 12, "TO_DO", "HIGH", "Waiting for access from the IT security team."],
      ["WCAG 2.1 accessibility audit", null, 25, "TO_DO", "MEDIUM"],
      ["Write the administrator handbook", "jakub.nowak", 30, "TO_DO", "LOW"],
      ["Load testing for the end-of-quarter peak", null, null, "TO_DO", "HIGH"],
      ["CSV export of orders to the ERP", "zofia.wisniewska", -10, "CANCELLED", "LOW", "Replaced by the direct ERP integration."],
    ],
  },
  {
    name: "Corporate website redesign",
    description: "New corporate website with a careers section, case studies and a multilingual news hub.",
    status: "IN_PROGRESS",
    start: -30,
    end: 53,
    owner: "jakub.nowak",
    members: [
      ["jakub.nowak", "OWNER", -30],
      ["julia.dabrowska", "COORDINATOR", -29],
      ["piotr.kaminski", "CONTRIBUTOR", -27],
      ["natalia.kwiatek", "CONTRIBUTOR", -20],
    ],
    tasks: [
      ["Content audit with the marketing team", "julia.dabrowska", -22, "COMPLETED", "MEDIUM"],
      ["Select a headless CMS", "piotr.kaminski", -15, "COMPLETED", "HIGH"],
      ["Migrate the news archive", "natalia.kwiatek", -1, "TO_DO", "MEDIUM", "About 300 articles from the current site."],
      ["Build the home page", "piotr.kaminski", 5, "IN_PROGRESS", "HIGH"],
      ["Cookie consent and GDPR review", null, 8, "TO_DO", "URGENT"],
      ["Newsletter sign-up form", "julia.dabrowska", 11, "IN_REVIEW", "MEDIUM"],
      ["Careers section with job listings", "piotr.kaminski", 14, "TO_DO", "MEDIUM"],
      ["Case study gallery", null, 28, "TO_DO", "LOW"],
      ["Translate the site into Polish, English and German", "julia.dabrowska", 40, "TO_DO", "MEDIUM"],
    ],
  },
  {
    name: "Field service mobile app",
    description: "Mobile app for service technicians with daily job schedules, offline checklists and customer signatures.",
    status: "COMPLETED",
    start: -210,
    end: -21,
    owner: "aleksandra.lewandowska",
    members: [
      ["aleksandra.lewandowska", "OWNER", -210],
      ["tomasz.wojcik", "COORDINATOR", -205],
      ["zofia.wisniewska", "CONTRIBUTOR", -200],
      ["piotr.kaminski", "CONTRIBUTOR", -200],
    ],
    tasks: [
      ["Job schedule with map view", "piotr.kaminski", -150, "COMPLETED", "HIGH"],
      ["Offline mode for checklists", "piotr.kaminski", -90, "COMPLETED", "MEDIUM"],
      ["Customer signature capture", "zofia.wisniewska", -70, "COMPLETED", "HIGH"],
      ["Push notifications for schedule changes", "tomasz.wojcik", -60, "CANCELLED", "LOW", "Dropped: the scheduling system has no event API."],
      ["Pilot with ten technicians", "zofia.wisniewska", -45, "COMPLETED", "MEDIUM"],
      ["App store release", "aleksandra.lewandowska", -25, "COMPLETED", "URGENT"],
      ["Final acceptance with operations management", "aleksandra.lewandowska", -21, "COMPLETED", "MEDIUM"],
    ],
  },
  {
    name: "Reporting platform cloud migration",
    description: "Moving the on-premises reporting servers to the cloud before the hardware support contract ends.",
    status: "TO_DO",
    start: 20,
    end: 140,
    owner: "julia.dabrowska",
    members: [
      ["julia.dabrowska", "OWNER", -5],
      ["tomasz.wojcik", "COORDINATOR", -4],
      ["michal.zielinski", "CONTRIBUTOR", -2],
    ],
    tasks: [
      ["Sign the cloud provider contract", "tomasz.wojcik", 30, "TO_DO", "HIGH"],
      ["Inventory reports and data sources", "michal.zielinski", 45, "TO_DO", "MEDIUM"],
      ["Approve the migration budget", "julia.dabrowska", 50, "TO_DO", "URGENT"],
      ["Define the rollback plan", null, null, "TO_DO", "LOW"],
    ],
  },
];

// Teams, birthdays and time off. Kept apart from the projects so a workspace
// seeded before these features existed can still receive them.
const teams: [string, Username[]][] = [
  ["Product & Design", ["natalia.kwiatek", "zofia.wisniewska"]],
  ["Engineering", ["jakub.nowak", "michal.zielinski", "piotr.kaminski", "tomasz.wojcik"]],
  ["Operations", ["aleksandra.lewandowska", "julia.dabrowska"]],
];

// [username, birth year, days until the next birthday]
const birthdays: [Username, number, number][] = [
  ["natalia.kwiatek", 1993, 40],
  ["jakub.nowak", 1990, 3],
  ["zofia.wisniewska", 1996, 0],
  ["michal.zielinski", 1994, 12],
  ["aleksandra.lewandowska", 1988, 150],
  ["piotr.kaminski", 1997, 25],
  ["julia.dabrowska", 1991, 210],
  ["tomasz.wojcik", 1995, 300],
];

// Directory details. Leads see why their team members are away.
// [username, years and days ago the account was created]: drives work anniversaries.
const joined: [Username, number, number][] = [
  ["natalia.kwiatek", 4, 0], ["jakub.nowak", 3, -6], ["zofia.wisniewska", 2, 40], ["michal.zielinski", 1, -2],
  ["aleksandra.lewandowska", 5, 120], ["piotr.kaminski", 1, 200], ["julia.dabrowska", 3, 300], ["tomasz.wojcik", 0, 8],
];

const details: { username: Username; job_title: string; pronouns?: string; phone: string; location: string; working_hours: string; skills: string[]; lead?: true }[] = [
  { username: "natalia.kwiatek", job_title: "Product lead", pronouns: "she/her", phone: "+48 601 234 567", location: "Warsaw office", working_hours: "Mon–Fri, 9:00–17:00", skills: ["Product discovery", "Roadmapping", "Stakeholder management"], lead: true },
  { username: "jakub.nowak", job_title: "Engineering manager", pronouns: "he/him", phone: "+48 602 345 678", location: "Warsaw office", working_hours: "Mon–Fri, 8:30–16:30", skills: ["PostgreSQL", "Node.js", "Release planning"], lead: true },
  { username: "zofia.wisniewska", job_title: "UX designer", pronouns: "she/her", phone: "+48 603 456 789", location: "Kraków · Hybrid", working_hours: "Mon–Fri, 10:00–18:00", skills: ["UX research", "Figma", "Accessibility", "Design systems"] },
  { username: "michal.zielinski", job_title: "Full-stack developer", phone: "+48 604 567 890", location: "Remote", working_hours: "Mon–Fri, 9:00–17:00", skills: ["TypeScript", "React", "Terraform"] },
  { username: "aleksandra.lewandowska", job_title: "Operations manager", pronouns: "she/her", phone: "+48 605 678 901", location: "Warsaw office", working_hours: "Mon–Fri, 8:00–16:00", skills: ["Vendor management", "Budgeting", "Compliance"], lead: true },
  { username: "piotr.kaminski", job_title: "Frontend developer", pronouns: "he/him", phone: "+48 606 789 012", location: "Gdańsk · Remote", working_hours: "Mon–Thu, 9:00–18:00", skills: ["React", "Web performance", "Testing"] },
  { username: "julia.dabrowska", job_title: "Infrastructure lead", phone: "+48 607 890 123", location: "Wrocław · Hybrid", working_hours: "Mon–Fri, 9:00–17:00", skills: ["AWS", "Kubernetes", "Networking"] },
  { username: "tomasz.wojcik", job_title: "QA engineer", pronouns: "he/him", phone: "+48 608 901 234", location: "Warsaw office", working_hours: "Mon–Fri, 9:00–17:00", skills: ["Test automation", "Playwright", "Exploratory testing"] },
];

// [username, type, first day offset, last day offset, note]
const absences: [Username, AbsenceType, number, number, string | null][] = [
  ["zofia.wisniewska", "VACATION", -2, 4, "Mountains with family"],
  ["julia.dabrowska", "OTHER", 0, 0, "Moving flat"],
  ["michal.zielinski", "BUSINESS_TRIP", 5, 7, "Client workshop in Gdańsk"],
  ["piotr.kaminski", "SICK_LEAVE", -10, -8, null],
  ["tomasz.wojcik", "VACATION", 20, 30, null],
  ["natalia.kwiatek", "VACATION", 40, 47, null],
];

async function seedPeople() {
  if ((await prisma.team.count()) > 0) {
    console.log("Teams already exist — skipping teams, birthdays and time off.");
    return;
  }
  const found = await prisma.user.findMany({ where: { username: { in: users.map(([username]) => username) } }, select: { id: true, username: true } });
  const byName = new Map(found.map((user) => [user.username as Username, user]));
  if (byName.size === 0) return;

  for (const [name, members] of teams) {
    const team = await prisma.team.create({ data: { name, name_key: name.toLowerCase() } });
    await prisma.user.updateMany({ where: { id: { in: members.flatMap((m) => byName.get(m)?.id ?? []) } }, data: { team_id: team.id } });
  }
  for (const [username, year, inDays] of birthdays) {
    const user = byName.get(username);
    if (!user) continue;
    const birth = day(inDays);
    birth.setUTCFullYear(year);
    await prisma.user.update({ where: { id: user.id }, data: { birth_date: birth } });
  }
  for (const [username, type, from, to, note] of absences) {
    const user = byName.get(username);
    if (user) await prisma.absence.create({ data: { user_id: user.id, type, start_date: day(from), end_date: day(to), note } });
  }
  console.log(`Seeded ${teams.length} teams, ${birthdays.length} birthdays and ${absences.length} time off entries.`);
}

/** Links a job title from the list, adding it first when it is missing. */
const jobTitle = (name: string) => ({
  connectOrCreate: { where: { name_key: name.toLowerCase() }, create: { name, name_key: name.toLowerCase(), can_lead: isManagerialTitle(name) } },
});

/** The starting list a super admin picks titles from; they can add more later. */
const baseJobTitles = ["Manager", "Project manager", "Team lead", "Developer", "Designer", "Tester", "Business analyst"];

async function seedJobTitles() {
  for (const name of baseJobTitles) {
    await prisma.jobTitle.upsert({ where: { name_key: name.toLowerCase() }, update: {}, create: { name, name_key: name.toLowerCase(), can_lead: isManagerialTitle(name) } });
  }
}

/** Fills in only what is still empty, so it is safe to run again. */
async function seedDetails() {
  let filled = 0;
  for (const { username, lead, job_title, ...fields } of details) {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, job_title_id: true, team_id: true } });
    if (!user || user.job_title_id) continue;
    await prisma.user.update({ where: { id: user.id }, data: { ...fields, job_title: jobTitle(job_title), ...(lead && user.team_id !== null ? { team_lead: true } : {}) } });
    filled++;
  }
  if (filled) console.log(`Added job titles, contact details and skills for ${filled} people.`);
}

/**
 * The sample super admin profile: photo, job title, contact details and skills.
 * Fills in only what is still empty, and only for the "superadmin" account that
 * seed-admin.ts creates, so a real installation's admin is never overwritten.
 */
async function seedAdminProfile() {
  const admin = await prisma.user.findUnique({ where: { username: "superadmin" }, select: { id: true, photo: true, job_title_id: true, phone: true, location: true, skills: true } });
  if (!admin) return;
  await prisma.user.update({ where: { id: admin.id }, data: {
    // Already a 512px WebP without metadata, as the profile upload stores it.
    ...(admin.photo ? {} : { photo: new Uint8Array(readFileSync(new URL("./seed-photos/superadmin.webp", import.meta.url))), photo_updated_at: new Date() }),
    ...(admin.job_title_id ? {} : { job_title: jobTitle("IT super manager") }),
    ...(admin.phone ? {} : { phone: "123456789" }),
    ...(admin.location ? {} : { location: "Kraków" }),
    ...(admin.skills.length ? {} : { skills: ["React", "UI/UX"] }),
  } });
}

/**
 * Backdates sample accounts so anniversaries show up (a negative day count means
 * the anniversary is that many days ahead). Only touches accounts made today or
 * later than their sample date, so it is safe to run again.
 */
async function seedJoinDates() {
  for (const [username, years, daysAgo] of joined) {
    const date = day(-daysAgo);
    date.setUTCFullYear(date.getUTCFullYear() - years);
    date.setUTCHours(9);
    await prisma.user.updateMany({ where: { username, created_at: { gt: date } }, data: { created_at: date } });
  }
}

// [username, suggested title, reason, days ago]: sample job title requests from each person's team lead.
const titleRequests: [Username, string, string, number][] = [
  ["michal.zielinski", "Senior full-stack developer", "Has owned the billing service end to end since the summer.", 0],
  ["zofia.wisniewska", "Design lead", "Runs the design system and mentors two juniors.", 1],
  ["aleksandra.lewandowska", "Operations manager", "Back to running operations after the QA rotation.", 3],
];

/** Pending requests for the super admin's dashboard, sent by the person's current team lead. Safe to run again. */
async function seedTitleRequests() {
  let added = 0;
  for (const [username, title, note, daysAgo] of titleRequests) {
    const person = await prisma.user.findUnique({ where: { username }, select: { id: true, team_id: true, title_requests_about: { select: { id: true }, take: 1 } } });
    if (!person || person.team_id === null || person.title_requests_about.length) continue;
    const lead = await prisma.user.findFirst({ where: { team_id: person.team_id, team_lead: true, id: { not: person.id } }, select: { id: true } });
    if (!lead) continue;
    await prisma.jobTitleRequest.create({ data: { user_id: person.id, requested_by: lead.id, title, note, created_at: day(-daysAgo) } });
    added++;
  }
  if (added) console.log(`Added ${added} job title requests.`);
}

async function main() {
  if ((await prisma.user.count({ where: { role: "USER" } })) > 0) {
    console.log("Users already exist — skipping sample users and projects.");
    await seedJobTitles();
    await seedPeople();
    await seedDetails();
    await seedJoinDates();
    await seedAdminProfile();
    await seedTitleRequests();
    return;
  }

  const ids = new Map<Username, number>();
  for (const [username, firstName, lastName] of users) {
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@flawment.dev`,
        password: await hashPassword("flawment123"),
        first_name: firstName,
        last_name: lastName,
      },
    });
    ids.set(username, user.id);
  }
  const id = (username: Username) => ids.get(username)!;

  for (const project of projects) {
    const manager = project.members.find(([, role]) => role === "COORDINATOR")?.[0] ?? project.owner;
    await prisma.project.create({
      data: {
        name: project.name,
        description: project.description,
        status: project.status,
        start_date: day(project.start),
        end_date: project.end === null ? null : day(project.end),
        owner_id: id(project.owner),
        memberships: {
          create: project.members.map(([username, role, joined]) => ({
            user_id: id(username),
            role,
            joined_at: day(joined),
          })),
        },
        tasks: {
          create: project.tasks.map(([title, assignee, deadline, status, priority, description], index) => ({
            title,
            description,
            assigned_to: assignee ? id(assignee) : null,
            created_by: id(index % 2 === 0 ? project.owner : manager),
            deadline: deadline === null ? null : day(deadline),
            status,
            priority,
          })),
        },
      },
    });
  }

  console.log(`Seeded ${users.length} users and ${projects.length} projects.`);
  await seedJobTitles();
  await seedPeople();
  await seedDetails();
  await seedJoinDates();
  await seedAdminProfile();
  await seedTitleRequests();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
