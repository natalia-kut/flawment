# Flawment

Flawment is an early-stage project management application built with Next.js 16
(App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7, and PostgreSQL 17.

It includes **Flawiusz**, an AI assistant on the dashboard and in a side panel on
every page. It answers questions about projects, deadlines and the team, and
creates document templates. It runs on a local language model, so it needs no paid
API; see [Set up Flawiusz](#set-up-flawiusz).

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
all projects. Project permissions live in `lib/rbac.ts`, with `tasks:manage` and
`tasks:update-assigned` reserved for future task endpoints (task management UI is
not part of this implementation).

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

## Set up Flawiusz

The app works without Flawiusz; the chat then shows that the assistant is not set up.
To enable it, add these lines to `.env` (see below for the values):

```dotenv
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen/qwen3-30b-a3b
```

Flawiusz works with any model that supports tool calling. The models below are only suggestions, the
ones Flawiusz was tested with; pick one that fits your hardware:

| Model | Memory | Notes |
|---|---|---|
| **Qwen3 30B-A3B** (suggested) | about 18 GB | Best answers of the two. It uses only about 3B parameters per token, so it stays reasonably fast even on a CPU. |
| **Qwen3 8B** | about 6 GB | Lighter alternative for computers with 16 GB of RAM. Weaker in Polish and on complex requests. |

Use either LM Studio or Ollama.

### LM Studio

1. In LM Studio, download the model, for example **Qwen3 30B-A3B** (choose a build with the hammer icon,
   which means tool support).
2. Open the **Developer** tab, load the model and set **Context Length** to at least **16384**.
3. Start the server (**Status: Running**, port 1234).
4. In `.env`, set `LLM_BASE_URL=http://localhost:1234/v1` and set `LLM_MODEL` to the model id listed
   at `http://localhost:1234/v1/models` (for example `qwen/qwen3-30b-a3b` or `qwen/qwen3-8b`).

### Ollama

```bash
ollama pull qwen3:30b   # Qwen3 30B-A3B; or qwen3:8b for the lighter model
```

In `.env`, set `LLM_BASE_URL=http://localhost:11434/v1` and `LLM_MODEL=qwen3:30b` (or `qwen3:8b`).

### Running the model on another computer

To run the model on a more powerful computer in the same network:

1. Make the server reachable from the network:
   - LM Studio: in **Settings**, turn on **Serve on Local Network**.
   - Ollama: set the environment variable `OLLAMA_HOST=0.0.0.0:11434` and restart Ollama.
2. Allow the port (1234 or 11434) in that computer's firewall, for private networks only.
3. Use that computer's IP address in `LLM_BASE_URL`, for example
   `http://192.168.0.150:1234/v1`.

Neither server has authentication. Never expose its port to the internet.

### Response time

Replies take a few seconds to about half a minute on a CPU. They are much faster when the model runs
on a GPU (in LM Studio, set **GPU Offload** to the maximum when loading the model).

Restart `npm run dev` after changing `.env`.

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
