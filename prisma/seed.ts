import "dotenv/config";
import { hashPassword } from "../lib/auth/password";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ProjectRole, ProjectStatus, TaskPriority, TaskStatus } from "../src/generated/prisma/enums";

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
      ["natalia.kwiatek", "ADMIN", -62],
      ["jakub.nowak", "MANAGER", -60],
      ["zofia.wisniewska", "PARTICIPANT", -58],
      ["michal.zielinski", "PARTICIPANT", -55],
      ["aleksandra.lewandowska", "PARTICIPANT", -40],
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
      ["jakub.nowak", "ADMIN", -30],
      ["julia.dabrowska", "MANAGER", -29],
      ["piotr.kaminski", "PARTICIPANT", -27],
      ["natalia.kwiatek", "PARTICIPANT", -20],
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
      ["aleksandra.lewandowska", "ADMIN", -210],
      ["tomasz.wojcik", "MANAGER", -205],
      ["zofia.wisniewska", "PARTICIPANT", -200],
      ["piotr.kaminski", "PARTICIPANT", -200],
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
      ["julia.dabrowska", "ADMIN", -5],
      ["tomasz.wojcik", "MANAGER", -4],
      ["michal.zielinski", "PARTICIPANT", -2],
    ],
    tasks: [
      ["Sign the cloud provider contract", "tomasz.wojcik", 30, "TO_DO", "HIGH"],
      ["Inventory reports and data sources", "michal.zielinski", 45, "TO_DO", "MEDIUM"],
      ["Approve the migration budget", "julia.dabrowska", 50, "TO_DO", "URGENT"],
      ["Define the rollback plan", null, null, "TO_DO", "LOW"],
    ],
  },
];

async function main() {
  if ((await prisma.user.count({ where: { role: "USER" } })) > 0) {
    console.log("Users already exist — skipping the seed to avoid overwriting data.");
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
    const manager = project.members.find(([, role]) => role === "MANAGER")?.[0] ?? project.owner;
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
