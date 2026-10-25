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
migrations, and generates Prisma Client. No separate `npm install` is needed.
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
running migrations. The seed script refuses to run when users already exist.

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
