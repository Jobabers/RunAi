# RunAI HTML Frontend

This is the plain HTML/CSS/JavaScript frontend for RunAI.

Current scope:

- `index.html` is the login screen.
- `register.html` is the register screen.
- `dashboard.html` is the Sprint 1 workspace for profile, goals, runs, history, and progress.
- These screens call the backend API at `http://localhost:4000/api`.
- Dashboard unlock order is Profile -> First Run -> Goal -> full dashboard.

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
