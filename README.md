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
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in the backend. Do not put Supabase secret keys in frontend HTML, CSS, or browser JavaScript.

### 4. Setup Supabase Database

In Supabase:

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `coding/backend/database/schema.sql`.
4. Go to Project Settings -> API Keys.
5. Copy the Project URL, Publishable key, and Secret/service role key into `coding/backend/.env`.

If this Supabase project already has the old RunAI tables with `public.users` and `password_hash`, run `coding/backend/database/migrate_to_supabase_auth.sql` first, then run `coding/backend/database/schema.sql`.

Use `coding/backend/database/reset_for_supabase_auth.sql` only for dev/test data because it drops existing RunAI tables without keeping backups.

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
