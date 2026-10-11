# RunAI

RunAI is a web application for improving running performance with AI-assisted training plans, daily quests, and a feedback loop after each quest result.

## Sprint 3 Progress

- Goal achievement checks distance and duration from the same run. Distance-only goals remain supported when no target duration is set.
- Achievement records `achieved_at` and `achieved_run_id`; it does not close the goal or plan.
- Dashboard offers Continue Training or Complete Goal. Continuing preserves the active plan and the option to finish later.
- Apply `coding/backend/database/sprint3-goal-achievement.sql` in Supabase before deploying this backend. It preserves existing completed goals; it does not reopen or backfill them.
- Apply `coding/backend/database/sprint3-analysis.sql` as well to enable the `progress_review` analysis type.
- Dashboard now compares the latest five runs with the previous five using total duration / total distance for pace. Gemini analysis is requested explicitly and cached when its input metrics have not changed. Errors preserve the last saved analysis.
- Adjustment history includes reasons, provider, decision time, and a snapshot of the original sessions next to proposed sessions. Older records without snapshots are labeled accordingly.
- Failed quest results remain saved if adjustment preparation fails. Retry prepares the adjustment without creating another running record or quest submission. Normal reads also attempt recovery for unprocessed failed/expired quests.
- Automated verification uses in-memory storage and mocked Gemini responses, not production accounts. Run `npm test` in `coding/backend`. Browser checks: `node coding/backend/scripts/check-sprint3-ui.cjs` from the repository root with Playwright available; defaults to installed Edge. Set `RUNAI_PLAYWRIGHT_PATH` for an external Playwright installation and `RUNAI_BROWSER_CHANNEL` to select another installed browser.
- Live verification on 2026-10-11 passed with the configured Supabase and real Gemini: Auth/profile/first run/goal, Gemini plan generation, 10km/55min completing the quest without achieving the goal, 10km/50min recording achievement, continue choice persisted through the dashboard RPC, progress analysis saved and cached, explicit goal/plan completion, and blocked submission after closure. The temporary test user was deleted afterward.
- Repeat the live test from `coding/backend` with `$env:RUNAI_LIVE_TEST='1'; node scripts/check-sprint3-live.cjs`. This creates temporary Supabase data, calls Gemini, and removes its own test user in cleanup; it uses the configured project and may consume API quota.
- Apply `coding/backend/database/sprint3-transactions.sql` after the schema and earlier Sprint 3 migrations. It provides service-role-only atomic commands for quest submission, run achievement, goal choices, adjustment persistence/decisions and expiry refresh. The configured Supabase project was migrated and verified on 2026-10-11.
- Apply `coding/backend/database/security-rls.sql` after `sprint3-transactions.sql`. It prevents browser users from changing goals, plans, quests, progress, or AI records directly through Supabase Data API; all writes must go through the backend.
- Pre-deployment acceptance passed: concurrent quest submissions produce exactly one run; concurrent adjustment accept/reject changes the decision once; invalid replacement rolls back all deleted/inserted sessions; past/today sessions are preserved; concurrent expiry records one result at Bangkok midnight; public keys cannot invoke privileged RPCs. Tests used disposable users and cleaned them up.
- Sprint 3 pre-deployment scope is complete. Production deployment and post-deployment smoke tests are intentionally left to the project owner; the live tests above exercise local backend code against real Supabase/Gemini, not the currently deployed Render code.

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
- Plan adjustment review with current-vs-proposed quest preview
- Accept or reject pending AI plan adjustments
- Optional Gemini AI planner with rule-based fallback
- Plain HTML/CSS/JavaScript frontend connected to the API
- Current frontend screen set: Google Sign-In, OAuth callback, profile, goal, run, history, and dashboard
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
AI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your-gemini-api-key
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in the backend. Do not put Supabase secret keys in frontend HTML, CSS, or browser JavaScript.
Use `GEMINI_API_KEY` only in the backend as well. Do not put AI keys in frontend HTML, CSS, or browser JavaScript.

### Google Sign-In Setup

RunAI uses Google Sign-In through Supabase Auth. The browser only receives the safe Supabase Publishable key from the backend; never expose the Service Role key.

1. In Google Cloud Console, create an OAuth Client ID with application type **Web application**.
2. Add the local and production site origins, for example `http://localhost:3000` and `https://run-ai-kappa.vercel.app`.
3. Add the Supabase callback URL as the Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase Dashboard, open **Authentication -> Providers -> Google**, enable Google, then paste the Google Client ID and Client Secret.
5. In **Authentication -> URL Configuration**, set the Site URL to the production frontend URL and add these Redirect URLs:
   - `http://localhost:3000/auth-callback.html`
   - `https://run-ai-kappa.vercel.app/auth-callback.html`

After Google Sign-In is enabled, RunAI creates the Supabase Auth user and the matching `public.profiles` row on the first login. The previous email/password register and login routes are disabled when `STORAGE_DRIVER=supabase`.

### 4. Setup Supabase Database

In Supabase:

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `coding/backend/database/schema.sql`, then the applicable Sprint migrations, ending with `coding/backend/database/security-rls.sql`.
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

create unique index if not exists uq_plan_adjustments_one_pending_per_plan
  on plan_adjustments (training_plan_id)
  where status = 'pending';
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

## Deployment Checklist

1. Merge the branch you want to deploy.
2. Run `coding/backend/database/schema.sql`, the Sprint 3 migrations, and finally `coding/backend/database/security-rls.sql` in Supabase SQL Editor so tables, RPCs, and database permissions are up to date.
3. Deploy `coding/backend` as a Node.js service.
   - Build command: `npm install`
   - Start command: `npm start`
   - Root directory: `coding/backend`
4. Add backend environment variables:

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-production-secret
FRONTEND_ORIGIN=https://your-frontend-url.example.com
AI_PROVIDER=gemini
AI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your-gemini-api-key
```

`FRONTEND_ORIGIN` can contain multiple origins separated by commas, such as local and production URLs.

5. Deploy `coding/frontend` as a static site.
6. If the frontend and backend are on different domains, edit `coding/frontend/config.js` before deploying:

```js
window.RUNAI_CONFIG = {
  apiBase: 'https://your-backend-url.example.com/api',
};
```

If the frontend host proxies `/api` to the backend, the default production value in `config.js` can stay as `/api`.

## Supabase Notes

Supabase Auth owns accounts in `auth.users`. RunAI profile data is stored in `public.profiles`; the app does not store `password_hash` in public tables.

Keep `SUPABASE_SERVICE_ROLE_KEY` in `coding/backend/.env` only. Never put secret keys in frontend HTML, CSS, or browser JavaScript.

## Gemini AI Setup

RunAI can use Gemini for Training Plan generation and future Quest adjustment.

For local development, the app still works without Gemini because the backend falls back to the rule-based planner.

To enable Gemini:

```env
AI_PROVIDER=gemini
AI_MODEL=gemini-3.5-flash-lite
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

### Supabase + Gemini End-to-End Checklist

Use this checklist before opening a pull request for Sprint 2 work:

- Set `STORAGE_DRIVER=supabase`, `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.5-flash-lite`, and `GEMINI_API_KEY` in `coding/backend/.env`.
- Run the backend and frontend with `.\run-dev.ps1`.
- Sign in with a Google test account.
- Complete Profile, First Run, and Goal.
- Confirm that Training Plan generation returns `source = gemini` in the backend response or dashboard plan source pill.
- Submit today's quest as completed when actual distance reaches the target distance.
- Test a second account or reset test data, then submit today's quest as failed with actual distance below target distance.
- Confirm that one pending adjustment appears, the dashboard shows its preview, and `Accept Plan` updates the plan version.
- Confirm that `Reject Plan` keeps the current plan and removes the pending adjustment from the dashboard.
- In Supabase Table Editor, confirm rows exist in `profiles`, `runs`, `goals`, `training_plans`, `training_sessions`, `training_progress`, `ai_analysis`, and `plan_adjustments`.
- Confirm there is only one pending adjustment per active training plan.

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
- Users can reject pending adjustments to keep the current plan.
- The dashboard shows Daily Quest as an RPG-style quest board with rank, reward, timer, calendar detail, and plan adjustment preview.
- Each active training plan can have only one pending adjustment at a time.

## Later Sprint Rules Preserved

- Full AI analysis quality and detailed adjusted-plan review/reject UI are planned for later sprints.
