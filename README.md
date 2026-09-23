# RunAI

RunAI is a web application for improving running performance with AI-assisted training plans, daily quests, and a feedback loop after each quest result.

## Current Sprint 2 MVP

- Backend API with Express
- In-memory development storage for tests
- Supabase PostgreSQL schema in `coding/backend/database/schema.sql`
- Authentication through Supabase Auth
- Profile, active goal, and running record APIs
- History and progress summaries
- Active goal rule: one user can have only one active goal
- Rule-based training plan generation from the active goal
- Daily Quest panel on the dashboard
- Quest submission with distance as the pass/fail criterion
- Calendar connected to training sessions and quest status
- Pending plan adjustment notice after a failed or expired quest
- Optional Gemini AI planner with rule-based fallback
- Plain HTML/CSS/JavaScript frontend connected to the API
- Current frontend screen set: login, register, profile, goal, run, history, and Sprint 2 dashboard
- First dashboard flow: Profile -> First Run -> Goal -> auto-generated Training Plan -> Daily Quest dashboard

Note: the backend runs with in-memory storage by default for local development. Set `STORAGE_DRIVER=supabase` and provide Supabase credentials to use persistent storage.

## Run Locally

### Requirements

Install these first:

- Node.js LTS, which includes `npm`
- Git
- A Supabase account and Supabase project
- Windows PowerShell, if you want to use `run-dev.ps1`

### 1. Clone or Open the Project

If this is the first time setting up the project:

```bash
git clone <repository-url>
cd "Project year 2 term 1"
```

If the project folder already exists, open the project root:

```bash
cd "C:\Users\ASUS\Desktop\Project year 2 term 1"
```

### 2. Install Dependencies

Install backend dependencies:

```bash
cd coding/backend
npm install
```

The frontend is plain HTML/CSS/JavaScript, so it does not need `npm install`.

### 3. Create Backend Environment File

Copy the example environment file:

```bash
cd coding/backend
copy .env.example .env
```

Then edit `coding/backend/.env` and fill in your Supabase settings:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional AI planner.
# Leave as rule-based if you do not have a Gemini key yet.
AI_PROVIDER=rule-based
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=your-gemini-api-key
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in the backend. Do not put Supabase secret keys in frontend HTML, CSS, or browser JavaScript.
Use `GEMINI_API_KEY` only in the backend as well. Do not put AI keys in frontend HTML, CSS, or browser JavaScript.

### 4. Setup Supabase Database

In Supabase:

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `coding/backend/database/schema.sql`.
4. Go to Project Settings -> API Keys.
5. Copy the Project URL, Publishable key, and Secret/service role key into `coding/backend/.env`.

If this Supabase project already has the old RunAI tables with `public.users` and `password_hash`, run `coding/backend/database/migrate_to_supabase_auth.sql` first, then run `coding/backend/database/schema.sql`.

Use `coding/backend/database/reset_for_supabase_auth.sql` only for dev/test data because it drops existing RunAI tables without keeping backups.

For the current schema, make sure these indexes exist in Supabase so the database also enforces one active goal and one active training plan per user:

```sql
create unique index if not exists uq_goals_one_active_per_user
  on goals (user_id)
  where status = 'active';

create unique index if not exists uq_training_plans_one_active_per_user
  on training_plans (user_id)
  where status = 'active';
```

### 5. Start the Project

Recommended: run backend and frontend together from the project root:

```bash
.\run-dev.ps1
```

Or run them manually in two terminals.

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

## Supabase Notes

Supabase Auth owns accounts in `auth.users`. RunAI profile data is stored in `public.profiles`; the app does not store `password_hash` in public tables.

Keep `SUPABASE_SERVICE_ROLE_KEY` in `coding/backend/.env` only. Never put secret keys in frontend HTML, CSS, or browser JavaScript.

## Gemini AI Setup

RunAI can use Gemini for Training Plan generation and future Quest adjustment.

For local development, the app still works without Gemini because the backend falls back to the rule-based planner.

To enable Gemini:

```env
AI_PROVIDER=gemini
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=your-gemini-api-key
```

Gemini is called from the backend only:

- Initial plan: `POST /api/training-plans/generate`
- Failed or expired quest adjustment: pending `plan_adjustments`

The backend validates AI output before saving it, and the user still has to accept adjusted plans before future sessions change.

## Team Git Workflow

- `main` is the main shared branch.
- Each teammate should work in their own branch.
- Example: `people-2` for one teammate and `first-hansom` for another teammate.
- Do not work directly on `main` during group development.
- Commit and push your own branch, then open a Pull Request to merge into `main`.

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

The frontend starts from authentication, then redirects logged-in users to `dashboard.html`. New users must complete Profile, enter their first run distance and duration, then create a Goal. Sprint 2 automatically generates a Training Plan from that Goal and unlocks the Daily Quest dashboard.

## Sprint 1 Scope

- Users must log in before using main features.
- Users must complete Profile before First Run and Goal.
- Users must add at least one Running Record before creating a Goal.
- Running Records are history data and can be added multiple times per day.
- One user can have only one active goal.
- Sprint 1 covers Auth/Profile, Goal, Running Record, History, and Progress.

## Sprint 2 Scope

- Users need at least one run before generating the first training plan.
- One user can have only one active training plan.
- Training plans are generated from today through the active goal target date.
- `training_sessions` are daily quests; there is no separate `quests` table.
- If a plan date has no training session, the dashboard shows it as a Rest Day.
- Quest success is based on actual distance.
- Submitted quest results cannot be edited or submitted again.
- Completing a quest creates a quest-sourced Running Record and Training Progress.
- Failed or expired quests can prepare a pending plan adjustment.
- Pending adjustments are shown on the dashboard and require user acceptance before future sessions change.

## Later Sprint Rules Preserved

- Full AI analysis quality and detailed adjusted-plan review/reject UI are planned for later sprints.
