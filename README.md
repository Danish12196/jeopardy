# Lockout - UNDER CONSTRUCTION

**Buzz first or sit it out.**

Lockout is a quiz night game for one TV and everyone's phone, built with React + Vite and PocketBase. The host runs the board, the TV shows the questions, and each team buzzes in from a phone. Buzzers stay locked until the host opens them, and the first phone in wins the chance to answer.

## Features

- Build a board from your own categories and questions, and save it as a template
- Add and name multiple teams
- TV board view with question reveal and live scores
- Host dashboard with the answer, the buzz queue and scoring
- Phone buzzers that show **Locked** and **Open** states in real time
- Responsive UI with [Tailwind CSS](https://tailwindcss.com)

## Brand

| Token | Value |
| --- | --- |
| Signal orange (accent) | `#FF5A1F` |
| Charcoal (background) | `#1C1C1E` |
| Off-white (text) | `#F4F1EA` |

Special rounds, when added, are called **Wildcard** (the hidden wager tile) and **All In** (the last round where every team wagers).

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open the URL Vite prints (usually http://localhost:5173).

## Database setup

The app expects a PocketBase (v0.23+) server. Set `VITE_PB_URL` in `.env` (see `env-sample`), then create the collections, access rules and batch setting with:

```bash
PB_URL=https://pb.danishali.dev PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD='...' \
  node scripts/init-db.mjs --dry-run   # preview, then run without --dry-run
```

Re-running is safe; it only adds what's missing. Add `--sync-rules` to reset access rules on existing collections.

Game templates are created in the PocketBase admin UI for now (pick categories and questions).

## Contribution

Contributions are welcome! Please feel free to submit a Pull Request.
