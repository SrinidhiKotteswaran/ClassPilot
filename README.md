# ClassPilot

**A student-focused academic planner that turns scattered schoolwork into an actionable next step.**

[**Open the live demo**](https://class-pilot-sigma.vercel.app/) · [Source code](https://github.com/SrinidhiKotteswaran/ClassPilot)

ClassPilot brings assignments, grades, classes, commitments, and study priorities into one workflow. The goal is to help a student decide what to work on next—not just provide another place to store a to-do list.

## Features

- **Dashboard:** a summary of upcoming work and academic progress
- **Assignments:** due dates, estimated workload, completion status, and priority
- **Classes and grades:** track current grades and target grades
- **Schedule:** organize recurring commitments and available study time
- **Grade calculations:** explore hypothetical scores and their effect on a target
- **Study planning:** generate a suggested plan based on assignments and available time
- **Demo mode:** explore the interface without creating an account or connecting a backend

## Screenshots

The repository's screenshots and the live demo are the best way to inspect the current interface. The public demo uses sample data; changes made in demo mode are stored in the current browser rather than a personal cloud account.

## How it works

The application is organized around reusable React components, typed application data, and separate services for data access. Assignment and class information feed the planning workflow, while the interface presents work by priority, due date, and estimated time.

## Technology

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase client integration
- Vercel deployment

## Run locally

Requires Node.js and npm.

```bash
git clone https://github.com/SrinidhiKotteswaran/ClassPilot.git
cd ClassPilot
npm install
npm run dev
```

Open the local URL printed by Vite.

## Demo mode and backend status

The current public configuration sets `DEMO_MODE = true`. In this mode, the app uses sample data and browser-local persistence, so it can be explored without a working Supabase project.

The repository also contains Supabase authentication and data-access integration. **Cloud authentication and persistent cloud data are not active in the current demo configuration.** Before enabling them for real users, configure the environment for the target deployment and verify database schema, access policies, and authentication flows. Do not put a Supabase service-role key or other server secret in client-side code.

## Project structure

```text
src/
  components/   reusable interface and authentication components
  context/      authentication and application data state
  lib/          shared client and utility logic
  pages/        dashboard, assignments, classes, schedule, settings
  services/     data-access layer
supabase/
  migrations/   database schema migrations
  functions/    edge-function code
extension/      browser extension project files
```

## Quality checks

Available scripts:

```bash
npm run typecheck
npm run lint
npm run build
```

## Current status

ClassPilot is an actively developed project. Demo mode is the dependable way to explore the deployed interface today; production cloud persistence and any external school-platform integration should be treated as separate work until configured and tested.

## Developer

Built by [Srinidhi Kotteswaran](https://github.com/SrinidhiKotteswaran).
