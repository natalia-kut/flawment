# Flawment

Flawment is an early-stage project management application. The current version is a UI scaffold: the sidebar lets you switch between Dashboard, Projects, Participants, Tasks, and Documents, and each section displays a placeholder.
The database and Prisma schema are part of the project foundation, but the current UI does not yet read from or write to the database.

## Tech stack

- **Next.js 16** with the App Router
- **React 19** and **TypeScript**
- **Tailwind CSS 4** and custom global CSS
- **Prisma 7** as the ORM, with a **PostgreSQL 17** database for local
  development

## Prerequisites

To run the web application, install:

- [Node.js 20.9 or later](https://nodejs.org/)
- npm (included with Node.js)

To run the optional local database and Prisma migrations, also install
[Docker Desktop](https://www.docker.com/products/docker-desktop/).

## Run the web application

1. Clone the repository and open a terminal in its root directory.
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

The current placeholder UI does not require a running database.

## Run PostgreSQL and Prisma migrations (optional)

The repository includes a Docker Compose service for PostgreSQL. Start it from
the project root:

```bash
docker compose up -d db
```

Set `DATABASE_URL` in a root-level `.env` file to match the local Compose
configuration:

```env
DATABASE_URL="postgresql://app_user:test@localhost:5432/flawment?schema=public"
```

The `test` password is for local development only; do not use it in a deployed
environment. Apply pending migrations and generate the Prisma client with:

```bash
npx prisma migrate dev
npx prisma generate
```

To stop the database container:

```bash
docker compose down
```

Docker Compose keeps database data in a named volume, so stopping the container
does not remove the data.

## Useful commands

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run lint      # Run ESLint
```
