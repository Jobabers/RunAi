# Sprint 3 Pre-Deployment Acceptance

Verified: 2026-10-11. Branch: people-2. Deployment excluded by owner request.

## Completed

- Quest completion depends on distance only.
- Goal achievement requires distance and duration from one run (duration optional for distance-only goals).
- Achievement preserves active goal/plan until the user explicitly completes the goal.
- Continue choice persists and the user can finish later.
- Real Gemini progress analysis is saved, reused for unchanged metrics, and errors retain the previous result.
- Adjustment history records provider, reason, before/after sessions and decision timestamps.
- Failed preparation can be retried without re-submitting or duplicating the quest result.
- Supabase transactions serialize mutations per user across backend instances.
- Goal closure and plan closure are committed together.
- Adjustment acceptance is all-or-nothing and cannot replace past/today sessions.
- Expiry uses 00:00 Asia/Bangkok; rest dates do not create running records or progress.
- Privileged RPCs are executable only by the backend service role.

## Evidence

- `npm test`: 16 passing tests, including four goal examples, validation, authorization, mocked AI recovery, and Bangkok midnight boundary.
- `scripts/check-sprint3-live.cjs`: real Supabase Auth/data, real Gemini plan/analysis/adjustments, concurrent submissions and decisions, deliberate invalid adjustment rollback, expiry concurrency, public-key permission checks. Temporary user deleted in cleanup.
- `scripts/check-sprint3-ui.cjs`: 1440px and 390px browser checks with API fixtures. Continue/complete controls, analysis, history, no JavaScript errors and no document overflow. This is not a production browser test.

## Deployment Handoff

The current Supabase project already has the migrations. For another database, run the base schema followed by Sprint 3 goal-achievement, analysis, and transactions SQL files. Do not deploy the new backend against a database without `runai_mutate`.

No push or deployment was performed as part of acceptance. After publishing, verify environment variables/CORS and repeat browser smoke tests against the production URL.
