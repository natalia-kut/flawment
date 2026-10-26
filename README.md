# Flawment

Flawment is an early-stage project management application built with Next.js 16
(App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7, and PostgreSQL 17.

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
sign in at `/login` with their email and password; use **Sign out** in the sidebar
to end the session. Email and username uniqueness is case-insensitive.

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

Any signed-in user can create a project in **Projects**, becoming its owner and
project `ADMIN` while retaining the standard account role. Select a project to
edit details, add existing active users, change member roles, remove members,
or delete the project, according to these permissions:

Projects opens as a card list. Opening a card shows a dedicated project view;
use the **Projects → project name** breadcrumb to return to the list. The selected
project is stored in the URL, so refresh and browser back/forward preserve
navigation. **New project**, **Edit project**, and **Add member** open dialogs
with Cancel, Escape, and backdrop dismissal. Creating a project opens its overview.

| Capability | PARTICIPANT | MANAGER | ADMIN | SUPER_ADMIN account |
| --- | --- | --- | --- | --- |
| View project, members and its document data | Yes | Yes | Yes | Every project |
| Edit project details | — | Yes | Yes | Yes |
| Add/remove participants | — | Yes | Yes | Yes |
| Assign ADMIN/MANAGER roles or remove elevated members | — | — | Yes | Yes |
| Delete project and its tasks | — | — | Yes | Yes |

The owner always remains a project admin and cannot be removed or demoted.
The available-user selector excludes existing members. Removing a member clears
their task assignments in that project. Deleted projects cascade to tasks and
memberships. Standard users only see projects they belong to; super admins see
all projects. Project permissions live in `lib/rbac.ts`, with
`tasks:manage` used for task creation and editing. The `tasks:update-assigned`
permission is reserved for future participant updates.

Super admins have access without project membership. They never appear in the
available-user selector, and server-side checks reject adding or changing them
through membership actions. Existing super-admin memberships are hidden from
standard users. Documents also hide their account details from standard users,
showing a generic administrator label where a project owner or task author is required.

Document templates belong to their creator. Standard users can only read or change
their own custom templates; super admins can manage all, including legacy
templates without an owner. Built-in templates remain available to signed-in users.

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

Unit tests check password hashing and permissions. Integration tests require the
migrated PostgreSQL database, create temporary accounts/projects, test auth and
role boundaries, and delete their test records afterward. Run them against a local
development database. To check the UI manually, register two users, create a
project as one, add the other, and sign in as each to check role-specific actions.

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

Open a project in **Projects** to view its tasks. Project admins, managers and
super admins can use **New task** and **Edit task**. The edit dialog supports
title, description, priority, deadline, assignment and these statuses:
TO DO, IN PROGRESS, IN REVIEW, COMPLETED and CANCELLED.

Tasks can only be assigned to active standard users who belong to the project.
Participants can view tasks; editing assigned tasks as a participant is not yet
implemented. Failed validation keeps the dialog values for correction.
No database migration is needed for these features.

To check editing manually, create a task, open **Edit task**, change its status
and priority, save and refresh the project. Confirm the changes remain visible.
Run the database integration coverage with npm run test:integration.

### Deleting project tasks

Project admins, managers and super admins can use **Delete task** in a project's
task list. Confirming the browser prompt permanently removes that task; Cancel
keeps it. Participants cannot delete tasks. Permissions and project ownership of
the task are checked again on the server. Deleting a task does not delete its
project or other tasks.

For a manual check, create a disposable task, click **Delete task**, cancel once,
then confirm on a second attempt. Refresh and confirm the task stays removed.

### Searching and filtering project tasks

In a project's Tasks section, search titles and descriptions or filter by status,
priority and assignee (including Unassigned). Filters combine, search ignores
letter case, and the result count shows how many tasks match. **Clear filters**
restores the complete project task list. Filters reset when another project is
opened and do not change stored tasks. They operate in the browser on the tasks
already loaded for the current project; existing server authorization still applies.

Manual check: create tasks with different statuses and priorities, search for a
word from a description, combine filters, check a no-results case, then clear.
Run npm test for search and filter coverage.

### Workspace Tasks page

The sidebar **Tasks** page lists tasks across projects returned by the existing
authorized workspace loader. Standard users see their projects; super admins see
all accessible projects. Search and filter by project, status, priority or assignee.
**Open project** navigates to the owning project, where existing task management
permissions apply. No tasks are fetched from a separate unrestricted endpoint.

Sidebar selection is now stored in the view query parameter (for example,
 /?view=tasks), so refresh and browser back/forward retain the selected page.
The per-project task lists and their management actions remain available.

Manual check: open Tasks, combine filters, clear them, then use Open project.
Refresh the Tasks page and check browser back/forward. Sign in as a user belonging
to fewer projects to confirm that only their project tasks are visible.
