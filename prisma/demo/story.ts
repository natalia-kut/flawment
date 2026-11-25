import type { ProjectRole, ProjectStatus, TaskPriority, TaskStatus } from "../../src/generated/prisma/enums";

// The sample workspace: projects at different points of their life, with people, comments and files.
// Every date is a number of working days from the day it is applied (-2: two working days ago),
// so nothing falls on a weekend and the story is always about now.

export type P = "N" | "J" | "Z" | "M" | "A" | "P" | "U" | "T";
export const usernames: Record<P, string> = {
  N: "natalia.kwiatek", J: "jakub.nowak", Z: "zofia.wisniewska", M: "michal.zielinski",
  A: "aleksandra.lewandowska", P: "piotr.kaminski", U: "julia.dabrowska", T: "tomasz.wojcik",
};

export const S = { D: "COMPLETED", R: "IN_REVIEW", I: "IN_PROGRESS", T: "TO_DO", X: "CANCELLED" } as const satisfies Record<string, TaskStatus>;
export const Q = { l: "LOW", m: "MEDIUM", h: "HIGH", u: "URGENT" } as const satisfies Record<string, TaskPriority>;
// [title, person, created, deadline, status, priority, completed?]
export type T = [string, P | null, number, number, keyof typeof S, keyof typeof Q, number?];
type Project = {
  name: string; description: string; status: ProjectStatus; start: number; end: number; owner: P;
  members: [P, ProjectRole][]; stages: { name: string; was?: string; deadline: number; tasks: T[] }[];
};

export const projects: Project[] = [
  {
    name: "Customer self-service portal",
    description: "B2B portal where customers place orders, download invoices and track support tickets, replacing ordering by email. The first three key accounts start in January.",
    status: "IN_PROGRESS", start: -57, end: 40, owner: "N",
    members: [["N", "OWNER"], ["J", "COORDINATOR"], ["Z", "CONTRIBUTOR"], ["M", "CONTRIBUTOR"], ["A", "CONTRIBUTOR"], ["T", "CONTRIBUTOR"]],
    stages: [
      { name: "Discovery and design", deadline: -38, tasks: [
        ["Run discovery workshops with key account managers", "N", -56, -48, "D", "m", -49],
        ["Define order approval and credit limit rules", "J", -56, -44, "D", "h", -43],
        ["Design the database schema", "M", -54, -42, "D", "h", -42],
        ["Design order flow wireframes", "Z", -52, -38, "D", "m", -39],
      ] },
      { name: "Core build", deadline: 6, tasks: [
        ["Set up the CI/CD pipeline", "M", -48, -36, "D", "l", -37],
        ["Customer accounts and permissions", "M", -45, -28, "D", "h", -29],
        ["Build order history and invoice view", "M", -42, -18, "D", "u", -17],
        ["Invoice PDF downloads", "M", -36, -13, "D", "m", -14],
        ["Support ticket form", "Z", -34, -10, "D", "m", -10],
        ["Order status tracking page", "J", -30, -8, "D", "m", -7],
        ["Visual design of the product catalogue", "Z", -34, -5, "D", "m", -4],
        ["Implement the order approval workflow", "A", -38, -2, "I", "h"],
        ["Product search and filters", "M", -26, 2, "R", "m"],
        ["Icons and illustrations for the catalogue", "Z", -12, 4, "I", "l"],
        ["Shopping cart and checkout", "M", -22, 6, "I", "h"],
      ] },
      { name: "Integrations", deadline: 18, tasks: [
        ["ERP test environment", "T", -24, -9, "D", "m", -9],
        ["Price list synchronisation with the ERP", "J", -30, -4, "D", "h", -3],
        ["Credit limit check against the ERP", "J", -28, -1, "D", "h", -1],
        ["Email notifications for shipped orders", "A", -20, 5, "I", "m"],
        ["Single sign-on with the corporate identity provider", null, -20, 8, "T", "h"],
        ["Direct ERP order integration", "J", -18, 14, "I", "h"],
        ["CSV export of orders to the ERP", "Z", -40, -25, "X", "l"],
      ] },
      { name: "Testing and launch", deadline: 36, tasks: [
        ["Test plan for user acceptance", "T", -16, -2, "D", "m", -2],
        ["WCAG 2.1 accessibility audit", "T", -14, 20, "T", "m"],
        ["Load testing for the end-of-quarter peak", "T", -12, 26, "T", "h"],
        ["Write the administrator handbook", "J", -14, 28, "T", "l"],
        ["User acceptance tests with three key accounts", "N", -3, 31, "T", "h"],
        ["Train the sales team", "A", -1, 34, "T", "m"],
      ] },
    ],
  },
  {
    name: "Corporate website redesign",
    description: "New corporate website with a careers section, case studies and a multilingual news hub. It goes live before the holidays, in Polish, English and German.",
    status: "IN_PROGRESS", start: -43, end: 20, owner: "J",
    members: [["J", "OWNER"], ["U", "COORDINATOR"], ["P", "COORDINATOR"], ["N", "CONTRIBUTOR"], ["Z", "CONTRIBUTOR"]],
    stages: [
      { name: "Content", deadline: -20, tasks: [
        ["Content audit with the marketing team", "U", -43, -35, "D", "m", -36],
        ["New information architecture", "Z", -42, -32, "D", "h", -31],
        ["Select a headless CMS", "P", -41, -33, "D", "h", -33],
        ["Brand guidelines for the web", "Z", -36, -24, "D", "m", -24],
        ["Migrate the news archive", "N", -38, -20, "D", "m", -21],
      ] },
      { name: "Build", deadline: 7, tasks: [
        ["Component library", "P", -30, -15, "D", "h", -16],
        ["Site search", "P", -26, -11, "D", "m", -11],
        ["Build the home page", "P", -28, -9, "D", "h", -8],
        ["Team and about pages", "N", -20, -6, "D", "l", -6],
        ["Careers section with job listings", "P", -24, -4, "D", "m", -4],
        ["Case study gallery", "Z", -20, -2, "D", "l", -3],
        ["Newsletter sign-up form", "U", -22, -2, "D", "m", -2],
        ["Cookie consent and GDPR review", "U", -18, 5, "R", "u"],
        ["Contact forms with CRM hand-off", "P", -14, 6, "I", "m"],
      ] },
      { name: "Launch", deadline: 18, tasks: [
        ["Redirects from the old site", "N", -10, 10, "T", "m"],
        ["Translate the site into Polish, English and German", "U", -26, 11, "I", "m"],
        ["Performance and SEO review", "P", -9, 13, "T", "h"],
        ["Launch announcement", "N", -4, 16, "T", "l"],
      ] },
    ],
  },
  {
    name: "Field service mobile app",
    description: "Mobile app for service technicians with daily job schedules, offline checklists and customer signatures. Handed over to operations in October.",
    status: "COMPLETED", start: -172, end: -38, owner: "A",
    members: [["A", "OWNER"], ["T", "COORDINATOR"], ["Z", "CONTRIBUTOR"], ["P", "CONTRIBUTOR"]],
    stages: [
      { name: "Build", deadline: -84, tasks: [
        ["Technician sign-in with a badge", "T", -168, -140, "D", "h", -141],
        ["Job schedule with map view", "P", -166, -130, "D", "h", -131],
        ["Offline mode for checklists", "P", -160, -98, "D", "m", -96],
        ["Photo attachments on jobs", "P", -140, -90, "D", "m", -91],
        ["Customer signature capture", "Z", -150, -84, "D", "h", -85],
        ["Push notifications for schedule changes", "T", -150, -80, "X", "l"],
      ] },
      { name: "Pilot and release", deadline: -38, tasks: [
        ["Pilot with ten technicians", "Z", -120, -62, "D", "m", -60],
        ["App store release", "A", -110, -46, "D", "u", -46],
        ["Technician training", "T", -100, -42, "D", "m", -43],
        ["Final acceptance with operations management", "A", -100, -38, "D", "m", -39],
      ] },
    ],
  },
  {
    name: "Reporting platform cloud migration",
    description: "Moving the on-premises reporting servers to the cloud before the hardware support contract ends. Finance keeps working on the old reports until the parallel run is over.",
    status: "IN_PROGRESS", start: -12, end: 85, owner: "U",
    members: [["U", "OWNER"], ["T", "COORDINATOR"], ["M", "CONTRIBUTOR"], ["J", "CONTRIBUTOR"]],
    stages: [
      { name: "Preparation", was: "milestone 1", deadline: 16, tasks: [
        ["Choose the cloud region and backup policy", "U", -12, -7, "D", "m", -8],
        ["Approve the migration budget", "U", -20, -5, "D", "u", -6],
        ["Network and VPN requirements", "J", -12, -3, "D", "h", -3],
        ["Cost estimate per report", "M", -10, -1, "D", "m", -1],
        ["Sign the cloud provider contract", "T", -20, 3, "R", "h"],
        ["Data retention rules", "U", -9, 5, "I", "m"],
        ["Inventory reports and data sources", "M", -20, 9, "I", "m"],
        ["Define the rollback plan", "U", -18, 15, "T", "m"],
      ] },
      { name: "Migration", deadline: 52, tasks: [
        ["Set up the cloud landing zone", "J", -6, 24, "T", "h"],
        ["Migrate the reporting database", "M", -6, 38, "T", "h"],
        ["Move scheduled reports", "M", -5, 45, "T", "m"],
        ["Rebuild access rights", "T", -5, 50, "T", "m"],
      ] },
      { name: "Cut-over", deadline: 82, tasks: [
        ["Parallel run with finance", "U", -4, 66, "T", "h"],
        ["Compare report performance", "T", -4, 70, "T", "l"],
        ["Switch users to the new platform", "J", -2, 78, "T", "h"],
        ["Decommission the old servers", null, -2, 82, "T", "l"],
      ] },
    ],
  },
  {
    name: "Warehouse barcode scanning",
    description: "Handheld scanners for goods receipt and picking, connected to the warehouse system. Starts with a pilot in one aisle.",
    status: "TO_DO", start: 32, end: 95, owner: "N",
    members: [["N", "OWNER"], ["A", "COORDINATOR"], ["P", "CONTRIBUTOR"], ["T", "CONTRIBUTOR"]],
    stages: [
      { name: "Analysis", deadline: 48, tasks: [
        ["Observe a day of picking in the warehouse", "A", -4, 36, "T", "m"],
        ["Compare three scanner models", "T", -4, 42, "T", "m"],
        ["Describe the goods receipt process", "A", -3, 46, "T", "h"],
      ] },
      { name: "Pilot", deadline: 90, tasks: [
        ["Scanner app prototype", "P", -3, 66, "T", "h"],
        ["Two-week pilot in one aisle", "T", -3, 86, "T", "m"],
      ] },
    ],
  },
];

// [task, author, working days ago, hour, text, reply to the previous one?]
export const comments: [string, P, number, number, string, boolean?][] = [
  ["Implement the order approval workflow", "N", -3, 9, "How far are we? Two key accounts asked about approvals yesterday."],
  ["Implement the order approval workflow", "A", -3, 11, "The rules work. The **second approval step** still needs an email template, I expect two more days.", true],
  ["Implement the order approval workflow", "J", -1, 10, "I can review it tomorrow morning."],
  ["Product search and filters", "M", -2, 13, "Ready for review: filters by category, price and availability."],
  ["Product search and filters", "N", -1, 9, "Looks great. Could we sort by *most ordered* by default?", true],
  ["Single sign-on with the corporate identity provider", "J", -4, 12, "We need someone from IT security on this before December."],
  ["Shopping cart and checkout", "M", -1, 15, "I am in Gdańsk for the client workshop next week, so I would like to finish this before then."],
  ["Visual design of the product catalogue", "Z", -5, 14, "Version 3 is attached, with the larger photos from the workshop."],
  ["Visual design of the product catalogue", "N", -4, 10, "Approved!", true],
  ["Cookie consent and GDPR review", "U", -2, 12, "Legal has the final texts and answers by Monday."],
  ["Newsletter sign-up form", "U", -2, 16, "Live on staging, double opt-in included."],
  ["Translate the site into Polish, English and German", "J", -3, 11, "German is done, Polish is in proofreading."],
  ["Inventory reports and data sources", "M", -1, 14, "The first 40 reports are in the attached file."],
  ["Network and VPN requirements", "J", -3, 15, "Agreed with the network team."],
  ["Final acceptance with operations management", "A", -39, 13, "Signed off, thank you all!"],
];

// [task, file, uploader, working days ago]
export const files: [string, string, P, number][] = [
  ["Run discovery workshops with key account managers", "workshop-summary.pdf", "N", -49],
  ["Define order approval and credit limit rules", "order-approval-rules.pdf", "J", -44],
  ["Visual design of the product catalogue", "catalogue-v3.png", "Z", -5],
  ["Price list synchronisation with the ERP", "price-list-sample.csv", "J", -3],
  ["Inventory reports and data sources", "report-inventory.csv", "M", -1],
  ["Cost estimate per report", "cloud-cost-estimate.pdf", "M", -1],
  ["Technician training", "technician-guide.pdf", "T", -43],
  ["Final acceptance with operations management", "acceptance-report.pdf", "A", -39],
];

export const teams: [string, P, P[]][] = [
  ["Product & Design", "N", ["N", "Z"]], ["Engineering", "J", ["J", "M", "P", "T"]], ["Operations", "U", ["U", "A"]],
];

// Time off that overlaps what someone already has is left out.
export const absences: [P, "VACATION" | "BUSINESS_TRIP" | "OTHER", number, number, string | null][] = [
  ["U", "OTHER", 0, 0, "Moving flat"], ["M", "BUSINESS_TRIP", 6, 7, "Client workshop in Gdańsk"],
  ["Z", "VACATION", 3, 7, "Long weekend in the mountains"], ["P", "BUSINESS_TRIP", 8, 9, "Conference in Berlin"],
];

export const stageDescriptions: Record<string, Record<string, string>> = {
  "Customer self-service portal": {
    "Discovery and design": "What customers need, the approval rules and the first designs.",
    "Core build": "Everything a customer uses to order and to follow an order.",
    "Integrations": "Prices, credit limits and orders exchanged with the ERP, and single sign-on.",
    "Testing and launch": "Audits, acceptance with key accounts and training.",
  },
  "Corporate website redesign": {
    "Content": "What we keep, what we rewrite and where it lives.",
    "Build": "Pages, forms and components, ready for real content.",
    "Launch": "Translations, redirects and the switch to the new site.",
  },
  "Field service mobile app": {
    "Build": "The app technicians use every day, also without network.",
    "Pilot and release": "Ten technicians first, then everyone.",
  },
  "Reporting platform cloud migration": {
    "Preparation": "Contract, budget and a full list of what has to move.",
    "Migration": "The database, the reports and the access rights.",
    "Cut-over": "Both platforms side by side, then only the new one.",
  },
  "Warehouse barcode scanning": {
    "Analysis": "How goods are received and picked today.",
    "Pilot": "Two weeks of real work in one aisle.",
  },
};

export const taskDescriptions: Record<string, string> = {
  // Customer self-service portal
  "Run discovery workshops with key account managers": "Five workshops with sales and customer service.",
  "Build order history and invoice view": "Filters by date, status and invoice number.",
  "Single sign-on with the corporate identity provider": "Waiting for access from the IT security team.",
  "CSV export of orders to the ERP": "Replaced by the direct ERP integration.",
  "Define order approval and credit limit rules": "Who approves what, from which amount, and what happens over the credit limit. Agreed with finance and two key accounts.",
  "Design the database schema": "Customers, orders, invoices and tickets, with room for several delivery addresses per customer.",
  "Design order flow wireframes": "From the catalogue to the confirmation, for desktop and phone.",
  "Set up the CI/CD pipeline": "Build, tests and deployment to staging on every merge.",
  "Customer accounts and permissions": "Each customer manages their own users.\n\n- Buyer: places orders\n- Approver: accepts orders over the limit\n- Accountant: sees invoices only",
  "Invoice PDF downloads": "Invoices from the last five years, one by one or as a ZIP for a chosen month.",
  "Support ticket form": "Customers report a problem with an order and attach photos. The ticket goes to the service team.",
  "Order status tracking page": "Shows where the order is and when it arrives, with a link to the carrier.",
  "Visual design of the product catalogue": "Product cards, filters and the product page, based on the new brand colours.",
  "Implement the order approval workflow": "Orders over the customer's limit wait for a second person.\n\n- [x] Approval rules per customer\n- [x] Approve and reject with a comment\n- [ ] Email template for the second step\n- [ ] Reminder after two days",
  "Product search and filters": "Search by name and SKU, with filters by category, price and availability.",
  "Icons and illustrations for the catalogue": "Category icons and pictures for the empty cart, no results and order sent.",
  "Shopping cart and checkout": "Cart with volume prices, delivery address and the order summary.\n\n- [x] Cart\n- [x] Volume prices\n- [ ] Delivery address\n- [ ] Order summary",
  "ERP test environment": "A copy of the ERP with anonymised customers, refreshed every night.",
  "Price list synchronisation with the ERP": "Customer prices are read every hour. A sample export is attached.",
  "Credit limit check against the ERP": "Asked when the order is placed; if the ERP does not answer, the order waits for approval.",
  "Email notifications for shipped orders": "Sent when the warehouse confirms the shipment, with the tracking link and the invoice.",
  "Direct ERP order integration": "Orders from the portal appear in the ERP without retyping.\n\n- [x] Order header and lines\n- [ ] Changes and cancellations\n- [ ] Error queue",
  "Test plan for user acceptance": "Scenarios, test data and who signs off.",
  "WCAG 2.1 accessibility audit": "Level AA, with a keyboard and a screen reader. Findings become separate tasks.",
  "Load testing for the end-of-quarter peak": "Three times the usual traffic for two hours, with the ERP connected.",
  "Write the administrator handbook": "Accounts, permissions, price lists and what to do when the ERP is down.",
  "User acceptance tests with three key accounts": "Each account orders, approves and downloads an invoice with their own data.",
  "Train the sales team": "Two one-hour sessions and a short recording for those who cannot attend.",
  // Corporate website redesign
  "Migrate the news archive": "About 300 articles from the current site.",
  "Content audit with the marketing team": "Every page marked as keep, rewrite or remove. About a third can go.",
  "New information architecture": "A menu with five entries instead of eleven, tested with eight people.",
  "Select a headless CMS": "Three systems compared on editing, translations and price.",
  "Brand guidelines for the web": "Colours, type and spacing, with examples for buttons and cards.",
  "Component library": "Reusable page blocks, documented and checked for accessibility.",
  "Site search": "Pages, news and job offers in one place, with typo tolerance.",
  "Build the home page": "Hero, key services, latest news and case studies.",
  "Team and about pages": "The company story, values and the management team.",
  "Careers section with job listings": "Open positions read from the recruitment system, with an application form.",
  "Case study gallery": "Twelve projects, filtered by industry.",
  "Newsletter sign-up form": "Double opt-in and an unsubscribe link, connected to the mailing tool.",
  "Cookie consent and GDPR review": "The banner, the cookie list and the privacy policy.\n\n- [x] List of cookies\n- [x] Consent banner\n- [ ] Final texts from legal",
  "Contact forms with CRM hand-off": "Enquiries go straight to the right sales team, with spam protection.",
  "Redirects from the old site": "Old addresses lead to the new pages, so search results keep working.",
  "Translate the site into Polish, English and German": "- [x] English\n- [x] German\n- [ ] Polish: proofreading",
  "Performance and SEO review": "Pages load under two seconds on a phone; titles and descriptions are complete.",
  "Launch announcement": "A news post, a newsletter and a note for the team.",
  // Field service mobile app
  "Push notifications for schedule changes": "Dropped: the scheduling system has no event API.",
  "Technician sign-in with a badge": "One tap with the company badge instead of a password.",
  "Job schedule with map view": "The day's jobs in the order of the route.",
  "Offline mode for checklists": "Checklists work without network and are sent when it is back.",
  "Photo attachments on jobs": "Up to ten photos per job, made smaller before sending.",
  "Customer signature capture": "The customer signs on the screen and gets the report by email.",
  "Pilot with ten technicians": "Two weeks in two regions, with a short call every Friday.",
  "App store release": "Published for company phones on both platforms.",
  "Technician training": "Half-day sessions in four branches and a quick guide, attached.",
  "Final acceptance with operations management": "All acceptance scenarios passed. The report is attached.",
  // Reporting platform cloud migration
  "Sign the cloud provider contract": "We have finished evaluating cloud providers, and the steering committee has chosen NimbusCloud Ltd. as our hosting partner for the next 3 years. The final contract draft was received from their legal team on November 20. It now needs to be reviewed, approved and signed before the end of the current billing cycle, so the migration can start in January as planned.\n\n**Scope of work:**\n\n1. Review the final contract draft (v3.2) in the shared folder /Legal/Contracts/NimbusCloud.\n2. Confirm that the agreed terms are included:\n\n- 99.95% uptime SLA with service credits for downtime\n- Data stored only in EU data centers (GDPR compliance)\n- Fixed pricing for the first 12 months\n- 90-day notice period for termination\n\n1. Get sign-off from Legal (Anna Novak) and Finance (Tom Brandt).\n2. Sign the contract electronically via DocuSign.\n3. Upload the signed copy to the contracts repository and notify the DevOps team.\n\nAcceptance criteria:\n\n- [ ] Legal and Finance approvals are recorded in the ticket\n- [ ] The contract is signed by both parties\n- [ ] The signed PDF is stored in /Legal/Contracts/NimbusCloud/Signed\n- [ ] The DevOps team is informed and the migration kickoff meeting is scheduled\n\n**Dependencies:**\n\nBlocked by: INFRA-112 \"Finalize cloud provider selection\" (Done)  \nBlocks: INFRA-130 \"Plan Phase 1 migration of staging environment\"\n\n**Notes:**  \nAny deviation from the agreed SLA or pricing terms must be escalated to the Head of IT before signing.",
  "Choose the cloud region and backup policy": "Data stays in the EU, with daily backups kept for 35 days.",
  "Approve the migration budget": "One-off migration cost and the first year of hosting.",
  "Network and VPN requirements": "Connections between the offices and the cloud, agreed with the network team.",
  "Cost estimate per report": "What each group of reports would cost per month. The summary is attached.",
  "Data retention rules": "How long each kind of data is kept and who may delete it.",
  "Inventory reports and data sources": "Owner, source and schedule of every report; unused ones are not moved.\n\n- [x] Finance\n- [x] Warehouse\n- [ ] Operations\n- [ ] Sales",
  "Define the rollback plan": "How to return to the old servers within four hours at any step.",
  "Set up the cloud landing zone": "Accounts, networks, monitoring and cost alerts.",
  "Migrate the reporting database": "A trial run first, then the real move over a weekend.",
  "Move scheduled reports": "In three groups, starting with the least critical.",
  "Rebuild access rights": "Roles by department instead of individual permissions.",
  "Parallel run with finance": "One full month-end close on both platforms; the results have to match.",
  "Compare report performance": "The twenty slowest reports, before and after.",
  "Switch users to the new platform": "Department by department, with help on the first day.",
  "Decommission the old servers": "After 30 days without use: final backup, wipe and return.",
  // Warehouse barcode scanning
  "Observe a day of picking in the warehouse": "Note where time is lost and where mistakes happen.",
  "Compare three scanner models": "Battery, weight, drop resistance and price.",
  "Describe the goods receipt process": "From the truck to the shelf, with the documents used on the way.",
  "Scanner app prototype": "Receipt and picking screens on a real device.",
  "Two-week pilot in one aisle": "Measures picking time and mistakes against today's process.",
};
