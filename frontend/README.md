# frontend

React 19 + TypeScript single-page app for the realtime-leaderboard API. It
exercises the three client flows end to end:

- **Submit score** — `POST /scores` with a generated `event_id`
- **Look up rank** — `GET /players/{player_id}/rank`
- **Leaderboard** — `GET /leaderboard?limit=&offset=` with paging

The API contract is `backend/openapi.json`; request/response types are mirrored
in `src/api/types.ts` (see "Types" below).

## Commands

```bash
npm ci            # install exactly from package-lock.json
npm run dev       # Vite dev server on :5173
npm test          # Vitest (single run)
npm run test:watch
npm run lint      # oxlint
npm run typecheck # tsc -b
npm run build     # type-check, then emit dist/
```

`make check` from the repository root runs `npm ci` plus lint, typecheck, test,
and build, so the frontend is covered by the same gate as the backend.

## Talking to the API

In development the Vite server proxies the API routes (`/scores`,
`/leaderboard`, `/players`, `/healthz`) to `http://localhost:8080`, so the
browser only ever makes same-origin requests and no CORS layer is needed. The
proxy target is fixed; run the backend on `:8080` (see the root README) or
change it in `vite.config.ts`.

For a build served from somewhere else, set `VITE_API_BASE_URL` to the API's
absolute URL; it defaults to same-origin (empty string). See `.env.example`.

Inside the dev sandbox, run `npm run dev` from a `make shell` and open host port
**5173** (`WEB_HOST_PORT` overrides it).

## Layout

```text
src/
├── api/
│   ├── client.ts       # typed fetch wrapper (ApiError, submitScore, getRank, getLeaderboard)
│   └── types.ts        # mirrors backend/openapi.json
├── components/
│   ├── ScoreForm.tsx
│   ├── RankLookup.tsx
│   └── Leaderboard.tsx
├── lib/uuid.ts         # newEventId() for idempotent submissions
├── test/
│   ├── setup.ts        # jest-dom matchers + RTL cleanup
│   └── mocks/          # MSW handlers + server
├── App.tsx
└── main.tsx
```

Tests are colocated with the code they cover (`*.test.tsx`, `client.test.ts`)
and run against MSW — no live backend is contacted.

## Types

`src/api/types.ts` is hand-written to match `backend/openapi.json`. If that
document changes, update the types in the same PR. Deriving them automatically
(for example with `openapi-typescript`) is a reasonable follow-up.
