# Flawment

Flawment is an early-stage project management application built with Next.js 16
(App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7, and PostgreSQL 17.

It includes **Flawiusz**, an AI assistant on the dashboard and in a side panel on
every page. It answers questions about projects, deadlines and the team, and
creates document templates. It runs on a free model from OpenRouter, so it needs
no paid API; see [Set up Flawiusz](#set-up-flawiusz).

## First-time setup (Windows and macOS)

Install these prerequisites yourself:

- [Node.js](https://nodejs.org/) **24 LTS**, including npm. Prisma also supports
  Node.js 20.19+ and 22.12+ on their respective release lines.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), started and
  ready. On Windows, use Linux containers (the WSL 2 backend is supported).
- Docker Compose v2 supporting `up --wait` (included with current Docker Desktop).

Clone the repository, open a terminal in its root directory, then run:

```sh
npm run bootstrap
```

This same command works in Windows PowerShell, Command Prompt, and macOS shells.
It checks Node.js and Docker, copies `.env.example` to `.env` if missing, installs
exact dependencies from `package-lock.json` using `npm ci`, starts PostgreSQL in
Docker Compose, waits up to 120 seconds for its health check, applies committed
migrations, generates Prisma Client, and seeds the super admin. No separate `npm install` is needed.
It exits on failure; fix the reported problem and rerun it.

Start the web application afterward:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Stop the development server
with Ctrl+C; PostgreSQL continues running in Docker.

Bootstrap is safe to rerun: it keeps your existing `.env` and database data and
applies only pending migrations. `npm ci` replaces `node_modules`; commit changes
to both dependency files together. Bootstrap does not create new migrations or
seed sample data. It is intended for local development and uses the database
selected by your existing `DATABASE_URL`.

## Environment configuration

`.env.example` is the committed template. `.env` is your local configuration and
is ignored by Git. Bootstrap creates it automatically, with:

```dotenv
DATABASE_URL="postgresql://app_user:test@localhost:5432/flawment?schema=public"
POSTGRES_PORT=5432
```

Next.js loads the root `.env` automatically. Prisma CLI and the seed script load
it using the explicitly installed `dotenv` dependency. Docker Compose reads
`POSTGRES_PORT` from the same file. Keep shared local configuration here; avoid
overriding `DATABASE_URL` in `.env.local`, since Prisma uses `.env`.
Variables already exported in your shell take precedence over `.env`.
Restart the development server after changing configuration.

The Compose database, user, and password are `flawment`, `app_user`, and `test`.
These credentials are for local development only. PostgreSQL is exposed only on
the host's loopback interface. If port 5432 is occupied, change `POSTGRES_PORT`
and the port in `DATABASE_URL` to the same free port, then rerun bootstrap.
If you change database credentials in Compose, also update `DATABASE_URL`.
PostgreSQL initialization settings only apply to a new volume; changing them
does not change credentials in an existing database.

### Why PowerShell set DATABASE_URL=... failed

`set NAME=value` is Command Prompt syntax. PowerShell uses `$env:NAME = "value"`;
macOS shells use `export NAME="value"`. Using `.env` avoids this difference.
You do not need a shell assignment for normal project commands.

To remove a stale override before rerunning commands:

```powershell
# Windows PowerShell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

```sh
# macOS
unset DATABASE_URL
```

## Daily development

| Command | Purpose |
| --- | --- |
| `npm run bootstrap` | Install dependencies, prepare `.env`, start DB, migrate, generate client |
| `npm run dev` | Start the development server |
| `npm run db:up` | Start PostgreSQL and wait for it to be healthy |
| `npm run db:down` | Stop Compose services, keeping database data |
| `npm run db:migrate -- --name describe_change` | Create/apply a migration after editing the Prisma schema |
| `npm run db:deploy` | Apply committed migrations without prompts |
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:seed` | Add optional sample data to an empty database |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

After pulling dependency or migration changes, rerun bootstrap. After editing
`prisma/schema.prisma`, run `db:migrate` and then `db:generate`, and commit the
resulting migration. Prisma 7 does not automatically generate the client when
running migrations. The sample-data seed skips when standard users already exist.

## Accounts and project roles

Open `/register` to create a standard account (username, name, email and a password
of 10–128 characters). Registration signs you in automatically. Returning users
sign in at `/login` with their email and password; use **Sign out** in the account
menu (your name at the foot of the sidebar) to end the session. Email and username uniqueness is case-insensitive.

Bootstrap creates the local super admin with:

- Email: `admin@flawment.local`
- Password: `FlawmentAdmin123!`

To seed it into an existing installation after applying migrations and generating
the client, run `npm run db:seed:admin`. Set `SUPER_ADMIN_EMAIL` and
`SUPER_ADMIN_PASSWORD` in `.env` before the first seed to choose other credentials.
Rerunning the seed preserves the existing account and password and refuses to
promote a colliding standard account. Production seeding requires explicit
credentials. Sample users/projects remain optional via `npm run db:seed`; sample
users use `flawment123` as their local-only password.

Permissions come in three independent layers: the **account** (company-wide),
the **team** (people) and the **project** (work).

**Account.** A **super admin** acts as the company's IT department: they see every
project and may do everything in it without being a member, and they alone manage
accounts, job titles and teams (the **People** and **Teams** pages). Super admins
never join teams or projects and are never assigned tasks; their accounts and
photos stay hidden from standard users. Everyone else has a **standard** account.

**Team.** A super admin places people in teams and may make someone with a
managerial job title the team's **lead**. A lead sees *why* their own people are
away (vacation, sick leave, business trip, other) and their team's time off in the
dashboard calendar. Everyone else sees only that a colleague is out of office, and
the reason for their own time off. Team membership is visible to everyone.

**Project.** Only **managers** (people whose job title can lead a team) and super
admins can start a project; the creator becomes its **Owner**.

| Capability | Contributor | Coordinator | Owner | Super admin |
| --- | --- | --- | --- | --- |
| View the project, its people, stages and tasks | Yes | Yes | Yes | Every project |
| Add tasks | Yes, for themselves or unassigned | Yes | Yes | Yes |
| Edit or delete tasks | Those they added | All | All | All |
| Change task status | Tasks they added or are assigned | All | All | All |
| Assign tasks | Only to themselves | Any member | Any member | Any member |
| Edit project details and stages | — | Yes | Yes | Yes |
| Add or remove members | — | Contributors only | Yes | Yes |
| Make someone a Coordinator | — | — | Yes | Yes |
| Delete the project | — | — | Yes | Yes |

There is exactly one Owner, who cannot be removed or demoted. Coordinators run the
work: the project, its stages, every task and its contributors. Contributors often
spot work themselves, so they add tasks too, but hand them only to themselves.
Removing a member clears their task assignments in that project. Deleting a
project also deletes its tasks, stages, memberships and project-specific document
templates. Standard users only see projects they belong to. Project permissions
live in `lib/rbac.ts`; every server action rechecks them.

Projects opens as a table. Clicking a project name shows its dedicated view; use
the **Projects → project name** breadcrumb to return to the list. The selected
project is stored in the URL, so refresh and browser back/forward preserve
navigation. **New project**, **Edit project** and **Add member** open dialogs with
Cancel, Escape and backdrop dismissal. **Manage** on a member opens a small menu
(role and **Remove from project**) that closes when you click elsewhere.

Document templates belong to their creator. Standard users can only read or change
their own custom templates; super admins can manage all, including legacy
templates without an owner. Built-in templates remain available to signed-in users.
In documents, the "Coordinators" fact and "Owner and coordinators" signatures list
a project's coordinators.

Sessions use random opaque cookies (`HttpOnly`, `SameSite=Lax`, `Secure` in
production) and hashed tokens in PostgreSQL, expire after seven days, and are
revoked on logout. Passwords use salted scrypt hashes, compatible with the
existing seed. Login allows ten attempts per email per 15-minute window. Production
must use HTTPS for the secure session cookie. Email invitations and password
recovery are not implemented yet.

### Verification

```sh
npm test
npm run test:integration
npm run lint
```

Unit tests cover password hashing, permissions, project and task filters, overdue
dates, progress, workspace task aggregation, time off, birthdays, anniversaries and
statuses. Integration tests check account and project access (who may start a
project and name coordinators), task creation/editing/deletion by each role, status
changes, stages, profiles, teams, job titles, time off and who may see what. They require the migrated PostgreSQL
database, create temporary records and remove them afterward. They run
sequentially to avoid interfering transactions on the shared database. Run them
against a local development database. To check the UI manually, sign in as a sample
manager (for example `aleksandra.lewandowska@flawment.dev`) and a contributor
(`michal.zielinski@flawment.dev`, password `flawment123`) and compare what each can do.

## Set up Flawiusz

Flawiusz uses the free
[NVIDIA: Nemotron 3.5 Super VL](https://openrouter.ai/nvidia/nemotron-3.5-super-vl)
model through [OpenRouter](https://openrouter.ai/). The app works without Flawiusz;
the chat then shows that the assistant is not set up.

1. Create an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
2. Add these lines to `.env`:

   ```dotenv
   LLM_BASE_URL=https://openrouter.ai/api/v1
   LLM_MODEL=nvidia/nemotron-3.5-super-vl:free
   LLM_API_KEY=sk-or-...
   ```

3. Restart `npm run dev`.

## Troubleshooting

- **Docker unavailable:** start Docker Desktop, wait for its engine to be ready,
  and check `docker info`. On Windows, ensure Linux containers are selected.
- **Database startup failure:** run `docker compose ps` and `docker compose logs db`.
  Check for port conflicts and available Docker resources.
- **Migration authentication/connection errors:** check `.env`, shell overrides,
  and the credentials originally used to initialize the database volume.
- **PowerShell blocks npm.ps1:** use `npm.cmd run bootstrap` (and `npm.cmd run dev`)
  instead of changing the execution policy.
- **npm missing:** reinstall Node.js with npm and open a new terminal; verify
  `node --version` and `npm --version`.

`npm run db:down` preserves the named `postgres_data` volume. To deliberately
delete all local database data, use `docker compose down --volumes`, then rerun
bootstrap. This deletion cannot be undone.

### Project task management

Open a project in **Projects** to view its tasks. Every member can use **New task**;
**Edit task** appears on the tasks you may edit (see the table above). The edit dialog supports
title, description, priority, deadline, assignment and these statuses:
TO DO, IN PROGRESS, IN REVIEW, COMPLETED and CANCELLED.

Tasks can only be assigned to active standard users who belong to the project.
Contributors assign tasks only to themselves (or leave them unassigned), edit and
delete the tasks they added, and change the status of tasks they added or are
assigned, by dragging a card or using **Move to** in task details.
Failed validation in the task form keeps its values for correction.
Apply the committed migrations before using task and stage features.

To check editing manually, create a task, open **Edit task**, change its status
and priority, save and refresh the project. Confirm the changes remain visible.
Run the database integration coverage with `npm run test:integration`.

### Deleting project tasks

Owners, coordinators and super admins can use **Delete task** on any task in a
project's task list; contributors on the tasks they added. Confirming the browser
prompt permanently removes that task; Cancel keeps it. Permissions and project ownership of
the task are checked again on the server. Deleting a task does not delete its
project or other tasks.

For a manual check, create a disposable task, click **Delete task**, cancel once,
then confirm on a second attempt. Refresh and confirm the task stays removed.

### Searching and filtering project tasks

In a project's Tasks section, search titles and descriptions or filter by status,
priority, stage and assignee (including **No stage** and **Unassigned**). Filters
combine, search ignores
letter case, and the result count shows how many tasks match. **Clear filters**
restores the complete project task list. Filters reset when another project is
opened and do not change stored tasks. They operate in the browser on the tasks
already loaded for the current project; existing server authorization still applies.

Manual check: create tasks with different statuses and priorities, search for a
word from a description, combine filters, check a no-results case, then clear.
Run `npm test` for search and filter coverage.

### Workspace Tasks page

The sidebar **Tasks** page displays an interactive board across projects returned
by the authorized workspace loader. Standard users see their projects; super
admins see all projects. Search titles and descriptions, or filter by project,
assignee, stage, priority, **Overdue** and **Only my tasks**. Grouped by project,
hovering a column shows **+ Create new**, which adds a task to that project in that column's status;
grouped by person, **New task** in the header lets you pick the project.
Click a card to open task details, then use **Open project** to navigate to its
project. Existing project permissions apply. No tasks are fetched from a separate
unrestricted endpoint.

Sidebar selection is now stored in the view query parameter (for example,
`/?view=tasks`), so refresh and browser back/forward retain the selected page.
The per-project task lists and their management actions remain available.

Manual check: open Tasks, combine filters, clear them, then use Open project.
Refresh the Tasks page and check browser back/forward. Sign in as a user belonging
to fewer projects to confirm that only their project tasks are visible.

### Interactive task board

The workspace Tasks page groups cards by project or person. Drag a card
between status columns within the same group to save a status change. Click a
card to open its details. The **Move to** selector in task details provides
keyboard and touch access. Only the status changes: drag does not reassign a task
or move it to a different project.

Owners, coordinators and super admins can move any project task. Contributors can
move the tasks they added or are assigned while they remain members. The server rechecks access,
project boundaries and the previous status; stale changes are rejected with an
error. Cards remain in their saved column if the request fails.

Search and filter by project, assignee, stage, priority, **Overdue** or
**Only my tasks**.
Overdue means a deadline before today's Warsaw date, excluding completed and
cancelled tasks. Progress counts completed tasks out of non-cancelled tasks and
is calculated for the complete group, independently of filters.
The Cancelled column appears for groups that contain cancelled tasks.

Manual check: move a disposable task from TO DO to IN PROGRESS, refresh and
confirm the saved status. Check By person, Only my tasks and Overdue.
Use the Move to select as a keyboard alternative and check a contributor account.

### Project stages

Project details now include **Stages**. Owners, coordinators and super admins
can create, edit and delete a stage with a name, description and optional deadline.
Contributors can read stages. Names are checked for duplicates within the project.
Stage cards show the number of completed tasks and total tasks assigned.

The task create/edit dialog includes **Stage**. A task can belong to one stage
from the same project, or **No stage**. Filter tasks by stage in both project task
lists and the workspace board. Task details show the stage without enlarging
board cards. Deleting a stage preserves its tasks and clears their stage link.

After pulling schema changes into an installed environment, start Docker Desktop,
stop the development server and run:

```sh
npm run db:up
npm run db:deploy
npm run db:generate
npm run dev
```

Alternatively, run `npm run bootstrap` and then `npm run dev`.
The stage migration adds `ProjectStage` and a nullable task-stage reference;
existing tasks start without a stage. Do not reset the database.

Manual check: create Planning, assign a task to it, filter by Planning, rename
the stage, then delete it. The task must remain visible with No stage.
Tests cover permissions, project boundaries, validation, assignment and deletion.

### Project browser

Projects are displayed in a table with deadline, status, task completion and
member count. Search names and descriptions, combine with a status filter, or
enable Show archived. Selecting the Archived status also reveals archived
projects. Clear filters restores the default view, which excludes archived items.

Completion is calculated from task statuses: completed tasks divided by all
non-cancelled tasks. A project without active tasks shows 0%. Project status
remains an independently managed value. Click a project name to open its details.
The table displays named statuses, long dates, overdue task counts and segmented
task progress. Search and status controls are available under **Filters**.
The displayed **Planned** status corresponds to `TO_DO` in the database.

### Profiles, statuses and celebrations

Click your name/photo at the foot of the sidebar to open the account menu
(**Set a status**, **Edit profile**, **Time off**, **Sign out**). **My profile**
saves everything where you edit it, with no Save button: click a contact detail
(phone, location, working hours, birthday, pronouns) to change it, add or remove
skills as chips, and upload or remove your photo. Colleagues see the birthday as
day and month only; the year never leaves the server. Your job title and team
are read-only, because a super admin sets them; **Reports to** lists your team's
leads. Skills replace the earlier free-text description, which has been removed.

A **status** ("🍽️ Lunch", "🚗 Commuting") is a short note with one emoji that
clears itself after 30 minutes, 1 or 4 hours, at the end of the day or week, or
never. Expiry times are worked out on the server in Europe/Warsaw time. Statuses
show on the profile, in the account menu, on team pages and in project People
lists. Work anniversaries count from the day the account was created. On your
birthday or anniversary the Dashboard greets you with a banner; on the day,
colleagues see a "🎂 Birthday today" or "🎉 3 years today" badge on team pages.

Profile photos accept non-animated JPEG, PNG or WebP, up to 2 MB and 16
megapixels. The server decodes the image, removes metadata, crops/resizes it to a
square of at most 512 pixels, and encodes WebP. The result is stored in
`User.photo`, a PostgreSQL `BYTEA` column (Prisma `Bytes`). Photo bytes are never
included in workspace JSON or session data. The authenticated photo endpoint
serves any standard user's photo to signed-in users (the company directory is
open) with private, non-cached responses; super admins' photos stay hidden.

### Teams, people and job titles

**Teams** shows every team as a tile, your own first and marked **Your team**.
Open a tile to see its people: availability, lead, job title and up to two
skills; click a person for their contact details, birthday, start date, status
and all skills. The Dashboard shows your own team as rings with each person's
open and late tasks (counted from projects you share) and who is away or
celebrating today.

A super admin also creates, renames and deletes teams, adds people to a team
(moving someone from another team asks for confirmation first), picks its lead
and sees warnings when a team has no lead. **New hires** on the Teams page lists
accounts still missing a job title or a team, with **Set up** to finish them.
**People** (super admins only) lists every account to edit name, email, job title,
team and lead. Job titles come from a shared list: type to pick one, or type a new
name to add it. A new title is managerial when its name says so (manager, lead,
head, director, chief, CTO…, or kierownik, dyrektor, lider, szef); **Job titles**
on the same page lists every title with a switch to correct that guess. Only people
with a managerial job title can lead a team or start a project, and a team has one
lead: making someone its lead replaces the previous one (the form names them first).
Losing that title, its managerial switch, moving team or deleting the team ends a
lead role. Deleting a team leaves its people without a team.

### Time off

**Time off** (account menu) lets you add or remove your own time off: vacation,
sick leave, business trip or other, with an optional note. Ranges cannot overlap
and can reach back at most 30 days. Colleagues only ever see that you are away
("Out of office until 20 Nov", or "Away 24 – 28 Nov" within the next 14 days).
The type (sick leave is health data) is added only for your team's leads and
super admins; the server leaves it out for everyone else. The note is visible to
you alone. Away badges appear on team pages, in project People lists, when adding
a project member and when assigning a task; back-to-back ranges read as one
absence. The dashboard calendar stripes your own days off, and shows a team lead
how many of their team are away each day.

For existing installations, stop the dev server, run `npm install`,
`npm run db:deploy` and `npm run db:generate`, then restart `npm run dev`.
`npm run bootstrap` includes the migrations and generation for fresh installations.
The migrations preserve existing data: free-text job titles become list entries
(titles with a managerial word such as "manager" or "lead" are marked managerial,
and leads whose title is not lose the role), project
specializations and the profile description are removed, and project roles become Owner (the project's
creator), Coordinator (former admins and managers) and Contributor (former
participants). `npm run db:seed` adds sample teams, job titles, birthdays, time
off and a sample super admin profile and photo, filling in only what is empty.

Verification: run `npm test`, `npm run test:integration` and `npm run lint`.
For the UI, compare a manager and a contributor (see above): starting a project,
adding and editing tasks, naming a coordinator, and what each sees about time off.
