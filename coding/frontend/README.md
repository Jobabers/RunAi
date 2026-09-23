# RunAI HTML Frontend

This is the plain HTML/CSS/JavaScript frontend for RunAI.

Current scope:

- `index.html` is the login screen.
- `register.html` is the register screen.
- `dashboard.html` is the Sprint 2 workspace for profile, active goal, training plan, daily quest, running records, history, and progress.
- `run.html` stores manual Running Records. Daily Quest submissions are sent from the dashboard quest panel.
- `goal.html` allows one active goal at a time.
- These screens call the backend API at `http://localhost:4000/api`.
- Dashboard unlock order is Profile -> First Run -> Goal -> auto-generated Training Plan -> Daily Quest dashboard.
- Daily Quest success is decided by actual distance and can be submitted only once.
- Failed or expired quests can show a pending AI plan adjustment that must be accepted before the future plan changes.

Run it with:

```bash
node server.js
```

Then open:

```text
http://localhost:3000
```

The backend API must also be running at:

```text
http://localhost:4000/api
```
