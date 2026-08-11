# AGENTS.md

## What this repo actually is

The directory name and `README.md` describe a "Wikidata EventStream tracker" but the code is **Politili Afrique** — an African leaders directory + opinion barometer. Trust `package.json` (name `politili-afrique`) and the code, not the README. All UI strings and API messages are French; keep them French.

## Run it (two servers required)

- `npm start` — Express server on `:3005` (`node --watch dev-server.js`, auto-restarts on file change). Serves `dist/` + all `/api/*` routes.
- `npm run dev` — Vite dev server on `:5173`, proxies `/api` → `:3005`.

Run **both** for frontend dev. Frontend changes need a `npm run build` before they appear under `npm start` (or run `vite` only).
`dist/` is committed to git — rebuild and commit it after `src/` changes.

## Architecture

- `api/*.js` are Vercel serverless handlers (default export `(req, res)`) that double as Express route handlers in `dev-server.js`. In dev-server and `vercel.json`, path params are passed as `req.query.id` (e.g. `/api/tracked/:id` → `tracked.js?id=$1`). Handlers only read `req.query.id`, never `req.params`.
- **No database.** `data/*.json` is the persistence layer (`africa_leaders.json`, `votes.json`, `questions.json`, `countries.json`, `wikidata_cache.json`) — all committed, written synchronously with `fs.writeFileSync`. Editing them is a real data change.
- Frontend: React 18 + Vite 6 + Tailwind 3 + shadcn-style components in `src/components/ui` (Radix). `@` alias → `./src` (both `vite.config.js` and `tsconfig.json`).
- Admin view is toggled by URL pathname containing `admin` (`src/App.tsx`); there is no separate `public/admin.html` even though `vercel.json` routes `/admin` to it.
- Live Wikidata calls (`api/search.js`, `api/tracked.js`) need network and send `User-Agent: PolitiliBot/2.0`.

## Gotchas

- No tests, no lint, no typecheck script. `tsconfig.json` is `strict: false`. Verify manually via the two dev servers.
- Admin auth: `ADMIN_USER`/`ADMIN_PASS`/`ADMIN_TOKEN` env vars (`.env.example`), with insecure hardcoded fallbacks in `api/admin/login.js`, `api/admin/check.js`, `api/tracked.js`. Client sends the token as `x-admin-token`. Only `/api/admin/check` validates the token — mutation endpoints (`tracked.js`, `countries.js`, `questions.js`) rely on the SPA for gating.
- `.env` (gitignored) holds `PORT`, `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_TOKEN`. Never commit real values.
- `scripts/enrich-leaders.mjs` re-uses `fetchAndEnrichFromWikidata` from `api/tracked.js` and only processes items lacking `enrichedAt`; it's a one-shot bulk enrich script that hits live Wikidata.
- `api/vote.js` (legacy) is a no-op ack; real voting persistence is `api/votes.js` with anti-fraud fingerprints.

## Code Quality & File Limits

- **Strict Line Count Limit**: Aucun fichier source (`src/`, `api/`, `scripts/`) ne doit dépasser **300 lignes de code**. Découper systématiquement les composants et modules en fichiers autonomes et modulaires.
