# ClassPilot

ClassPilot is a student-focused academic command center I built to answer one practical question: **what should I work on next?**

**[Live app →](https://class-pilot-sigma.vercel.app/)**

## What it does

- Organizes classes, assignments, grades, and commitments in one dashboard
- Tracks assignment due dates, workload, completion, and priority
- Calculates hypothetical grades and category-weighted outcomes
- Generates daily study plans from available time and assignment priority
- Supports authentication and persistent Supabase/Postgres data when configured
- Includes a demo mode so the interface can be explored without backend credentials

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- PostgreSQL
- Vercel

## Architecture

The application is organized around a small set of focused layers:

```text
src/
  components/   application UI, forms, authentication, and reusable controls
  context/      authentication and application data state
  lib/          planning, priority, formatting, categories, and Supabase helpers
supabase/
  migrations/  database schema and migrations
  functions/   backend functions and integrations
extension/      browser-extension experiments for Schoology workflows
```

The core design separates UI components from application state and the utility logic that handles planning, priorities, formatting, and data access.

## Local development

```bash
npm install
npm run dev
```

For a production-style check:

```bash
npm run lint
npm run typecheck
npm run build
```

The app can run in demo mode without Supabase credentials. To enable cloud authentication and persistence, configure the Vite Supabase environment variables consumed by `src/lib/supabase.ts`.

## Development notes

ClassPilot grew out of a simple idea: school systems often expose information without helping students decide what to do with it. I built the project around turning assignments, grades, deadlines, and available time into actionable priorities.

The project is intentionally more than a static UI: it includes application state, authentication, persistent data, planning logic, and a browser-extension experiment for bringing Schoology information into the workflow.

## Current status

ClassPilot is an active personal software project. The main application is deployed through Vercel, while Supabase-backed features depend on the configured environment and database setup.

Planned areas include:

- More robust Schoology synchronization
- Expanded study-plan recommendations
- Stronger automated end-to-end testing
- Continued mobile and accessibility refinement

## Author

**Srinidhi Kotteswaran**

[GitHub profile →](https://github.com/SrinidhiKotteswaran)
