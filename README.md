# EnCave

Book unique wine tasting experiences directly with Swiss winemakers.

## Tech Stack

- **Framework:** Next.js 14 (App Router), deployed on Vercel
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL (Neon) — Prisma 5.x
- **Auth / payments / email:** better-auth, Stripe Connect, Resend
- **i18n:** next-intl (fr default, de, en)
- **Testing:** Vitest (unit, integration, DB invariants) + Playwright (e2e)

`CLAUDE.md` is the authoritative reference for conventions and business
rules; `docs/ARCHITECTURE.md` describes the application as it runs;
`docs/runbooks/` holds the operational procedures.

## Getting Started

### Prerequisites

- Node.js 20 LTS or higher
- npm (comes with Node.js)
- Docker (local PostgreSQL via `docker-compose.yml`), or a disposable
  [Neon](https://neon.tech) branch — never the production database

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Samoulou/encave-app.git
cd encave-app
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your database connection string and other required
variables. Every variable is validated at boot by `src/lib/env.ts`.

4. Start the local database, push the schema and seed it (`npm install`
   already generated the Prisma client):

```bash
npm run dev:db:start
npm run dev:db:setup
```

5. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command                | Description               |
| ---------------------- | ------------------------- |
| `npm run dev`          | Start development server  |
| `npm run build`        | Build for production      |
| `npm run start`        | Start production server   |
| `npm run lint`         | Run ESLint                |
| `npm run format`       | Format code with Prettier |
| `npm run format:check` | Check code formatting     |
| `npm run i18n:check`   | Check the 3 locale files  |
| `npm run test`         | Run tests in watch mode   |
| `npm run test:run`     | Run tests once            |
| `npm run test:e2e`     | Playwright e2e (test DB)  |

> ⚠️ **`npm run build` migrates a database.** Its `prebuild` step
> (`scripts/deploy-migrations.js`) loads `.env.local` and runs
> `prisma migrate deploy` against `DIRECT_URL` whenever that variable is
> set. That is how Vercel applies migrations on deploy — and it means a
> local build applies every pending migration to whatever database your
> `.env.local` points at. Keep `.env.local` on a local or disposable
> database, or run the build with `SKIP_DB_MIGRATIONS=1`. Never put the
> production `DIRECT_URL` in `.env.local`.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   └── api/             # API routes
├── components/          # React components
│   ├── ui/              # shadcn/ui primitives
│   └── shared/          # Shared components
├── lib/                 # Client utilities
├── server/              # Server-only code
└── types/               # TypeScript types
```

## Environment Variables

See `.env.example` for all required environment variables with descriptions.

## Database

This project uses Prisma with PostgreSQL. Database schema is defined in `prisma/schema.prisma`.

### Useful Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a migration
npx prisma migrate dev --name migration_name

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (development only)
npx prisma migrate reset
```

## Deployment

Deployed on [Vercel](https://vercel.com) through the Git integration:

| Environment | Branch           | URL                     |
| ----------- | ---------------- | ----------------------- |
| Preview     | feature branches | auto Vercel URL         |
| Staging     | `dev`            | `encave-dev.vercel.app` |
| Production  | `main`           | `encave.ch`             |

- Each build runs `prisma migrate deploy` first (see the warning above).
  Migrations are additive only; production requires `DIRECT_URL`. The
  Preview scope must point at the preview database, never production.
- Scheduled jobs are declared in `vercel.json` and authenticate with
  `Authorization: Bearer $CRON_SECRET` — the variable is mandatory on every
  environment.
- Two env switches are read by the Edge middleware and need a redeploy to
  take effect: `COMING_SOON` (launch gate, anything but `false` keeps
  encave.ch on the Coming Soon page) and `MAINTENANCE_MODE` (`true` =
  maintenance page + write freeze, see `docs/runbooks/restauration-db.md`).
- Feature kill-switches live in the database and are toggled from `/admin`
  (`docs/runbooks/kill-switch-flags.md`).

## Contributing

1. Create a feature branch from **`dev`** (`samuel/enc-XX-slug`) — never
   commit to `dev` or `main` directly
2. Make your changes
3. Run `npm run lint`, `npm run format:check` and `npm run i18n:check`
4. Run `npm run test:run` to ensure tests pass
5. Open a pull request targeting **`dev`** (staging). `dev` → `main`
   (production) is a separate pull request, once staging is validated

## License

Private - All rights reserved
