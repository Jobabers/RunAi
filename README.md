# RunAI

RunAI is a web application for planning running training with AI-assisted training plans, daily quests, and a feedback loop after each quest result.

## Current MVP

- Backend API with Express
- In-memory development storage
- Supabase PostgreSQL schema in `coding/backend/database/schema.sql`
- Authentication through Supabase Auth
- Goal and running history APIs
- AI placeholder service for generating and adjusting training plans
- Daily quest submission rules
- Plain HTML/CSS/JavaScript frontend connected to the API
- Current frontend screen set: login, register, and Sprint 1 dashboard
- First dashboard flow: Profile -> First Run -> Goal -> full Sprint 1 dashboard

Note: the backend runs with in-memory storage by default for local development. Set `STORAGE_DRIVER=supabase` and provide Supabase credentials to use persistent storage.

## Run Locally

Backend:

```bash
cd coding/backend
npm run dev
```

Frontend:

```bash
cd coding/frontend
node server.js
```

Default URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`

## Supabase Setup

Run `coding/backend/database/schema.sql` in Supabase SQL Editor first.

If this Supabase project already has the old RunAI tables with `public.users` and `password_hash`, run `coding/backend/database/reset_for_supabase_auth.sql` first, then run `coding/backend/database/schema.sql`. Use the reset file only for dev/test data because it drops existing RunAI tables.

Create `coding/backend/.env` from `coding/backend/.env.example`, then set:

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in the backend. Do not put Supabase secret keys in frontend HTML, CSS, or browser JavaScript.

Supabase Auth owns accounts in `auth.users`. RunAI profile data is stored in `public.profiles`; the app does not store `password_hash` in public tables.

## Verification

Backend tests:

```bash
cd coding/backend
npm test
```

Frontend syntax check:

```bash
cd coding/frontend
node --check app.js
node --check dashboard.js
node --check server.js
```

The frontend starts from authentication, then redirects logged-in users to `dashboard.html`. New users must complete Profile, enter their first run distance and duration, then create a Goal before the full Sprint 1 dashboard is unlocked.

## Core Rules Preserved

- Users must log in before using main features.
- Users must complete Profile before First Run and Goal.
- Users need at least one run before generating the first training plan.
- One user can have only one active training plan.
- `training_sessions` are daily quests; there is no separate `quests` table.
- Quest success is based on actual distance.
- Submitted quest results cannot be edited.
- Failed or expired quests trigger AI analysis and adjustment of future sessions only.
- A user must accept an adjusted plan before it becomes active.
