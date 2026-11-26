# Contributing

Set up the project with the [README](README.md). How the application works is
described in the [Wiki](https://github.com/natalia-kut/flawment/wiki).

## Workflow

1. Start from an up-to-date `main`, on a branch named after the change:
   `feat/project-tabs`, `fix/file-size-limit`, `chore/vercel`.
2. Open a pull request to `main` and fill in the template. Open it as a draft if
   it is not ready.
3. Wait for CI to pass, then squash and merge. The pull request title becomes the
   commit on `main`.

Review is welcome but not required. Ask for one when a change touches permissions,
migrations or somebody else's area.

## Titles and commits

Use one line of [Conventional Commits](https://www.conventionalcommits.org/) in
English:

| Prefix | Use for |
| --- | --- |
| `feat:` | New or changed behaviour |
| `fix:` | A bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code changes with the same behaviour |
| `test:` | Tests only |
| `chore:` | Dependencies, configuration, tooling |

## Before you open a pull request

```sh
npm run lint
npx next typegen
npx tsc --noEmit
npm test
npm run test:integration
```

Integration tests need the local database to be running and migrated. They create
temporary records and remove them afterward.

## Database changes

Edit `prisma/schema.prisma`, run `npm run db:migrate -- --name describe_change` and
`npm run db:generate`, and commit the migration. Never edit a migration that is
already on `main`; add a new one.
