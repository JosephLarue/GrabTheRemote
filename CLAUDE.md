# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GrabTheRemote: one shared YouTube screen per room, the crowd votes on what plays next. Next.js 15 (App Router, React 19, Tailwind 4), Postgres via Drizzle, Redis via ioredis, SSE for live sync. No accounts: identity is an HMAC of the client IP. Product rules (cooldowns, skip/report thresholds, themes, rooms) are described in `README.md`; read it first for the feature vocabulary (pool, remote fight, stolen remote, Hall of Shame, private rooms, Twitch room).

## Commands

```bash
pnpm install
cp .env.example .env.local          # works as-is for local dev
docker compose up -d                # Postgres :5435, Redis :6380
pnpm db:migrate
pnpm dev                            # http://localhost:3000

pnpm lint                           # eslint (next/core-web-vitals + next/typescript)
pnpm typecheck                      # tsc --noEmit (CI runs it after build; .next/types must exist)
pnpm test                           # vitest unit tests (*.test.ts next to source; excludes tests/functional)
pnpm test:functional                # tests/functional against docker-compose Postgres + Redis
pnpm build && pnpm start

# single test file / single test name
pnpm vitest run src/lib/fight.test.ts
pnpm vitest run --config vitest.functional.config.ts tests/functional/vote.test.ts -t "cooldown"

pnpm db:generate                    # after editing src/server/db/schema.ts; commit drizzle/
pnpm env:decrypt | env:encrypt      # .env.local <-> .env.local.enc with .env.key (ENV_KEY)
```

- Functional tests create/migrate a `gtr_test` database and use Redis db 15, wiping both before each test. `tests/functional/urls.ts` refuses a DB name not ending in `_test` or Redis db 0. Override with `TEST_DATABASE_URL` / `TEST_REDIS_URL`. They run route handlers in-process (import `POST` from `src/app/api/*/route.ts`), with `fetch` stubbed: Turnstile passes only for token `CAPTCHA_OK`, YouTube oEmbed 404s. Any other network call throws. Use `tests/functional/helpers.ts`: `seedVideo` to put metadata in Postgres (no API), `vote`/`skip`/`report`/`veto` as viewer N (each viewer is a distinct IP and cookie jar), `addViewers` for presence, `setTheme` to pin a theme, `playNext` to advance the room.
- CI (`.github/workflows/ci.yml`) on PRs into `dev`/`main`: lint, unit, functional, migrate empty DB, **schema/drizzle sync check** (fails if `schema.ts` changed without a committed migration), build, typecheck, smoke test of `pnpm start`.
- `DISABLE_TICKER=1` skips starting the playback ticker (see `src/instrumentation.ts`).

## Architecture

### Where state lives
- **Redis** = everything live: vote pool, now-playing, presence, cooldowns, skip/report votes, themes per slot, YouTube meta cache, quota counter, private room settings, rate limits. Every key is built in `src/server/keys.ts` (`K.*`), per-room keys prefixed `room:<id>:`. Never put raw IPs in keys, only the hash from `src/server/ip.ts`.
- **Postgres** (`src/server/db/schema.ts`) = history: `videos` (metadata + `flagged`/`banned`), `plays` (one row per thing shown on screen, with `endReason`, viewer-seconds, peak viewers), `banned_channels`, `blocked_keywords`, `theme_slots`. Hall of Fame/Shame is computed from `plays`.
- **Every tunable number** is in `src/config/app.ts`. Themes in `src/config/constraints.ts`. Room list and per-room identity in `src/config/rooms.ts`.

### Playback engine (`src/server/engine.ts`)
`startTicker()` runs from `src/instrumentation.ts` in the Node runtime, once per process, `setInterval` 1s. Each tick iterates public rooms + live private rooms, each under `withLock(room, fn, { wait: false })`: a Redis `SET NX PX` lock in `K.lockAdvance`, so several instances can run and only one advances a room. Anything that changes playback (`advance`, `pausePlayback`, routes for skip/report/veto/admin) **must run inside `withLock`**. `advance()` closes the current `plays` row, pops the pool leader that passes moderation + room rules (`popBest`), else a fallback from the room's most-watched or `FALLBACK_VIDEOS`, inserts the new play, then publishes events. Pool changes are coalesced: routes call `markPoolDirty`, the ticker publishes at most once a second.

### Live sync
`publish(room, event)` writes `<room>|<json>` to the single Redis pub/sub channel `events`. `bus()` in `src/server/state.ts` holds one subscriber per process and re-emits by room on an EventEmitter. `src/app/api/stream/route.ts` is the SSE endpoint: sends a full `snapshot` on connect, then forwards bus events, pings presence every 10s. Viewer count = size of the presence zset within `PRESENCE_WINDOW_S`. Client side, `src/lib/live.tsx` (`LiveProvider`, `useLive`, `useServerNow`) applies `LiveEvent`s onto the `LiveSnapshot`; event types are defined in `src/lib/types.ts`. Adding a live field means: type in `types.ts`, publish in server, `apply()` case in `live.tsx`, include in `snapshot()`.

### API routes (`src/app/api/*`)
Pattern from `src/app/api/vote/route.ts`: `export const POST = handle(async (req) => { ... })` from `src/server/http.ts`. Throw `ApiError(status, code, message, extra)` for user-facing failures; `handle` turns them into `{ error, message }` JSON. Error **codes** are translated client-side via `errorText` in `src/i18n`, so new codes need dict entries. Resolve the room with `openRoom(req, body.room, { kind: 'youtube' | 'twitch', owner?: true })`, which also enforces private-room password cookies. Typical order in a route: `ipHash` → `rateLimit` → cheap Redis checks → `verifyTurnstile` → YouTube meta (`getMeta`, may throw `QuotaExhaustedError`) → `assertAllowed`/`assertFitsRoom` → theme check → write. Server modules import `'server-only'`.

### Rooms
`RoomId = PublicRoomId | PrivateRoomId`. Public rooms are the `ROOMS` const (`en`, `fr`, `es`, `it`, `jungle`, `twitch`); each has a language rule (`fitsLanguage`: only refuse videos that declare a *different* language), a decor and a UI locale. Private rooms (`p-xxxxxx`) exist only in Redis (`src/server/private-rooms.ts`), expire after a day idle, carry their own `RoomSettings` (rules, themes mode, locale, decor) read through `roomSettings()` in `src/server/room-settings.ts`. Always go through `roomSettings`/`themeFor` rather than the public defaults so private rooms behave. The Twitch room (`isTwitchRoom`) has no pool: separate state machine in `src/server/twitch.ts`, routes under `api/twitch/*`.

### Routing, locale, decor
`src/middleware.ts` (edge runtime, no node:crypto): origin lock via `x-origin-secret` when `ORIGIN_SECRET` is set (exempt: `/api/health`), Basic auth on `/admin`, redirects `/`, `/vote`, `/hall` to the last room (cookie `gtr_room`) or the Accept-Language match, and sets header `x-gtr-room` so pages outside a room (`/privacy`, `/legal`) follow the last room's language and look. Pages live under `src/app/[room]/` and share `LiveProvider` from the room layout. UI copy is in `src/i18n/{en,fr,es,it}.ts` (type `Dict` from `en.ts`; all four must stay in sync). Room decor is CSS variables under `:root:has([data-room="…"])` in `src/app/globals.css`, keyed by `Decor` (`DECORS`/`DECOR_INFO` in `src/config/rooms.ts`), not by room: The Jungle draws `alliance` or `horde` per request through `decorOf()` in `src/server/room-settings.ts` (React `cache`, so layout, viewport and out-of-room pages agree), and the client keeps the decor it was served for public rooms.

### YouTube metadata
`src/server/youtube.ts`: `getMeta(id, { allowFetch })` reads Redis cache → Postgres `videos` → Data API, counting quota in Redis (`YT_QUOTA_SOFT`/`HARD`, resets midnight Pacific). With empty `YT_API_KEY` it falls back to oEmbed with a fake 3-minute duration. Pass `allowFetch: false` on read paths (pool display) so only votes spend quota.

### Admin
`/admin` is a server-component page with server actions in `src/app/admin/actions.ts` (ban video/channel, keywords, force skip, drop candidate, theme weights, Twitch pin/change/ban). After editing blocklists call `invalidateBlocklists()`.

## Conventions

- Branch flow: feature branch → PR into `dev` → merge only when CI green → release PR `dev` → `main`. Railway deploys `main`.
- `NEXT_PUBLIC_*` vars are baked at build time.
- `plan-de-claude-le-bogoss/` holds French planning notes and numbered recaps; the highest number is the current "reste à faire", `TODO-JOSEPH.md` is the owner's go-live checklist. Add a new numbered recap rather than editing old ones.
- `.env.local.enc` is committed and encrypted; `.env.key`, `.env.local`, `.env.railway` are not. Never commit real keys in plain text.
