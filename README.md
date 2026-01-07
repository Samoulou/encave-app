# EnCave

Book unique wine tasting experiences directly with Swiss winemakers.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma 5.x
- **Testing:** Vitest

## Getting Started

### Prerequisites

- Node.js 20 LTS or higher
- npm (comes with Node.js)
- PostgreSQL database (local or [Neon](https://neon.tech))

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/encave.git
cd encave
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your database connection string and other required variables.

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Run database migrations (when you have a database):

```bash
npx prisma migrate dev
```

6. Start the development server:

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
| `npm run test`         | Run tests in watch mode   |
| `npm run test:run`     | Run tests once            |

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

This project is configured for deployment on [Vercel](https://vercel.com).

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run lint` and `npm run format`
4. Run `npm run test:run` to ensure tests pass
5. Create a pull request

## License

Private - All rights reserved
