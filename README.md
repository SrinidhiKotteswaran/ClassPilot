# ClassPilot

ClassPilot is a student-focused academic command center for organizing classes, assignments, grades, commitments, and daily study priorities in one place.

**Live app:** https://class-pilot-sigma.vercel.app/

## What it does

- Dashboard with upcoming work and academic progress
- Class management with current/goal grades
- Assignment tracking with completion, due dates, workload, and priorities
- Weekly commitments and schedule planning
- Grade calculator for hypothetical scores
- Daily study-plan generation based on assignment priority and available time
- Demo mode that works without backend credentials and persists changes locally
- Supabase-ready authentication and persistent cloud data when environment variables are configured

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase Auth + Postgres
- Vercel

## Run locally

```bash
npm install
npm run dev
```

The app can run in demo mode without Supabase credentials. To enable cloud authentication and database persistence, add the Vite Supabase environment variables used by `src/lib/supabase.ts`.

## Production

The `main` branch is connected to Vercel, so every push to `main` creates a new production deployment.

## Project structure

```text
src/
  components/   reusable UI and authentication screens
  context/      auth and application data state
  lib/          planning, priority, formatting, and Supabase helpers
  pages/        dashboard, assignments, classes, schedule, settings
  services/     Supabase/data access layer
supabase/
  migrations/   database schema
  functions/    Schoology sync edge function
```

## Roadmap

- Connect a Supabase production project
- Add secure row-level security policies and production auth
- Add Schoology sync configuration
- Expand study-plan recommendations
- Add automated end-to-end browser tests
- Improve mobile UX and accessibility
