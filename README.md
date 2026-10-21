# Jeopardy Game - UNDER CONSTRUCTION

A customizable Jeopardy game built with React+Vite, supporting team play, categories, and scoring.

## Features

- Create and configure a Jeopardy game board with custom categories and values
- Add and name multiple teams
- Interactive game board with question reveal and scoring
- State persistence via local storage
- Responsive UI with [Tailwind CSS](https://tailwindcss.com)

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
