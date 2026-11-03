# GrabTheRemote 📺🔴

> One screen. The whole internet. Only one remote.

Remember fighting your siblings over the TV remote? Now do it with **everyone online, at the same time**.

GrabTheRemote is a single shared screen playing YouTube videos. Everybody watches the same video at the same second. What plays next? **The crowd decides.** Democracy, but louder.

---

## 🛋️ How it works

1. **Grab the remote** — paste a YouTube link on the Vote page. You get **one vote every 15 minutes**. Choose wisely. Or chaotically. We don't judge. (We do a little.)
2. **Pile on** — see a link you like in the queue? Give it a +1.
3. **The crowd has spoken** — when the current video ends, the most-voted video jumps on screen and its votes are spent. Everyone else's votes stay in the fight.
4. **Watch together** — same video, same frame, same cringe, for everyone.

## 🌍 Rooms

Five screens, five crowds: 🇬🇧 **English** (`/en`), 🇫🇷 **Français** (`/fr`), 🇪🇸 **Español** (`/es`), 🇮🇹 **Italiano** (`/it`) and 🌴 **The Jungle** (`/jungle`), where anything goes and the walls side with the Alliance or the Horde, drawn at random on each visit. Each room has its own queue, its own remote, its own vote cooldown and its own Hall of Fame. Themes are shared.

Language rooms only refuse a video when YouTube says it's in another language; videos that don't declare a language get the benefit of the doubt. The Jungle takes anything.

Landing on `/` takes you back to your last room, or to the one matching your browser language. The interface speaks the room's language (English in The Jungle); `/privacy`, `/legal` and `/admin` stay in English.

## 🔒 Private rooms (for streamers)

Doing react content? Go to `/private` and make your own room. You get an **ID** and a **password** to show your chat, plus a secret owner link to run the room from another device.

You set the rules: **max video length**, **one vote every** 30 s to 15 min, the **video language**, whether the **skip** and **report** buttons exist, and the **themes** (the roulette, no theme, or one theme all session). Pick the page language and the room's look (any public room's decor, or the Alliance and Horde looks of The Jungle). Change any of it live.

During the stream you can **pause** everyone's screen, **skip** what's playing, or **close** the room. Your chat votes like in any other room. A room disappears after a day with nobody watching.

## 🎲 Theme roulette

> Switched off for now (`THEMES_ENABLED` in `src/config/app.ts`): no theme in any room, every video is accepted.

Every 15 minutes the remote *might* get possessed. Sometimes there's no rule. Sometimes it's:

- ⏱️ **Under 2 minutes** — no time for your 14-minute video essay
- 🐜 **Under 30 seconds** — blink and it's gone
- 💎 **Fewer than 10,000 views** — dig up a hidden gem
- 🚀 **Over 100M views** — hits only, sorry indie kings
- 📼 **Uploaded before 2012** — peak internet archaeology
- 🎸 **Music only** · 🎮 **Gaming only** · 🤡 **Comedy only**
- 📢 **TITLE IN ALL CAPS** — LIKE THIS ONE
- …and more chaos where that came from

If your link doesn't match the theme, the remote slaps your hand away.

## 🔴 The big red button

Hate what's playing? Smash **SKIP**. If half the room agrees, it's gone.

But careful: once a skip passes, the button **overheats for 30 minutes**, for the whole room. Spend it wisely.

## 🚨 The yellow button

Something nasty on screen? Hit **REPORT**. If 10% of viewers agree, the video gets yanked and replaced with a big *MASS REPORTED* card, and the next pick takes over. The crowd is the bouncer.

## 🎯 The stolen remote

Once an hour, at a random moment, the remote gets stolen. One random person who voted recently and is watching right now gets **🎯 YOU have the remote** and a **VETO** button for 60 seconds: one press kills what's playing. No vote, no cooldown. Everyone else just sees the countdown and sweats.

## ⚔️ Remote fight

When the top two videos in the queue are neck and neck, a **REMOTE FIGHT** banner shows up with a live tug-of-war bar. Pick a side.

## 😂 Couch reactions

😂 💀 🔥 😍 🤮 👏 float up over the TV for everyone, live. A fixed set of emojis, so there's nothing to moderate, and **5 per minute per viewer** so nobody papers the screen.



- **Most watched** — the crowd's all-time favorites
- **Most picked** — the videos that keep coming back
- **Biggest landslide** — the most votes for a single pick
- **Peak crowd** — the biggest audience ever in the room
- **Hall of Shame** — fastest skips, vetoes and mass-reported disasters, each with its own roast ("Skipped faster than a YouTube ad"). Legends, in their own way. Every entry has a **📸 Share** card: *"Skipped after 4s by 600 people."*

## 🃏 Shame cards

Every Hall of Shame entry is a holographic trading card with a rarity: **Legendary** (died in under 5 s), **Epic**, **Rare**, **Common**, **Mythic** (vetoed) and **Banned** (mass-reported). Voted for a video the crowd killed? The card is yours: it lands in **My collection** on the Hall of Shame tab and you can download it as a PNG. Collections live in your browser.

## 🎟️ Bring your friends

Under the TV, the **🎟️ ticket** gives you an invite link. Bring 3 friends to the room within a day (each one has to watch for 45 seconds) and you vote **every 5 minutes for an hour** instead of every 15. The code is derived from your scrambled IP; each friend counts once per room.

## 🔔 Sounds and surprises

Button clicks, channel-change static, a buzzer when the crowd skips, applause when your pick wins, an alarm when the remote gets stolen, and the TV **shatters** on a veto. All synthesized in the browser, no files, one 🔔 switch in the remote to turn them off. There are also three easter eggs on the watch page, each once an hour at most: the Konami code, five taps on an antenna, five taps on a knob.

## 🔊 "Why is it muted?!"

Browsers hate surprise noise. Click the giant wobbling **CRANK IT UP 🔊** sticker once and you're in.

## 🙅 No accounts. Ever.

No sign-up, no password, no "verify your email". Just show up and grab the remote. Votes are tied to a scrambled (hashed) version of your IP, never the real thing, and a quick captcha keeps the robots off the couch. 🤖🚫

## 📜 House rules

- Embeddable YouTube videos only, any length
- No age-restricted content
- One vote per 15 minutes per connection
- Be fun. Don't be gross. The crowd *will* report you.

---

## 🛠️ For the nerds

Stack:

- **Next.js 15 + TypeScript + Tailwind** for the goofy-but-pretty frontend
- **Postgres (Drizzle)** for history and the Hall of Fame
- **Redis** for votes, cooldowns, the queue and live state
- **Server-Sent Events** to keep everyone's screen in sync
- Two stacked YouTube players: the likely next video is cued on the standby one during the last minute, so the switch is instant
- `/sitemap.xml`, `/robots.txt` and a web manifest (installable); public rooms and their Hall of Fame carry hreflang and canonical, and a live couch count in their description and share card
- **Cloudflare Turnstile** to stop the bots
- **YouTube IFrame + Data API** (with aggressive caching, because quota is precious)

### Run it locally

You need Node 22 (`.nvmrc`), pnpm and Docker.

```bash
pnpm install
cp .env.example .env.local      # works as-is for local dev
docker compose up -d            # Postgres on :5435, Redis on :6380
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```

- **No YouTube API key?** Leave `YT_API_KEY` empty. Dev mode falls back to oEmbed, with a fake 3-minute duration and no view counts, so the themes won't be accurate. Get a key from the [Google Cloud console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) (YouTube Data API v3).
- **Turnstile:** `.env.example` ships Cloudflare's test keys, which always pass. Use real keys in production.
- **Admin:** `/admin`, any username, password = `ADMIN_PASSWORD`.
- **Tests:** `pnpm test` (unit), `pnpm test:functional`, `pnpm typecheck`, `pnpm lint`.
- **Functional tests** (`tests/functional/`) call the API routes and admin actions in-process against the docker-compose Postgres and Redis, with Turnstile and YouTube stubbed: voting rules, queue to screen, skip, report, admin moderation, state and preview. They create and migrate a `gtr_test` database and use Redis db 15, both wiped before each test (override with `TEST_DATABASE_URL` / `TEST_REDIS_URL`; the database name must end in `_test`).
- **CI** (`.github/workflows/ci.yml`) runs on every PR into `dev` or `main` and after each merge: lint, unit tests, functional tests, migrations on an empty Postgres, a check that `schema.ts` and `drizzle/` are in sync, build, typecheck, then a smoke test of the production server (health, every room, redirects, 404, admin auth). If you change `schema.ts`, run `pnpm db:generate` and commit `drizzle/`.
- **Encrypted env:** `.env.local.enc` is committed; the key is not. With the key in `.env.key` (or `ENV_KEY`), run `pnpm env:decrypt` to restore `.env.local`. After editing it, run `pnpm env:encrypt` and commit the `.enc`. First time: `pnpm env:keygen`.

### How it fits together

| Piece | Where |
|---|---|
| Every tunable number (cooldowns, thresholds, quota limits) | `src/config/app.ts` |
| Themes | `src/config/constraints.ts` |
| Rooms (list, names, browser-language pick) | `src/config/rooms.ts`, routing in `src/proxy.ts`, pages in `src/app/[room]` |
| UI copy per room language (en, fr, es, it) | `src/i18n` |
| Playback ticker, queue advance, per-room lock | `src/server/engine.ts`, started from `src/instrumentation.ts` |
| Live state, SSE fan-out, viewer presence | `src/server/state.ts`, `src/app/api/stream` |
| YouTube metadata cache (Redis → Postgres → API) and quota guard | `src/server/youtube.ts` |
| Moderation filters | `src/server/moderation.ts` |
| Redis keys | `src/server/keys.ts` |

The ticker needs a **long-running Node process** (not serverless). Run a single instance; several work too, since the Redis lock ensures only one advances playback.

### Deploying (Railway or Fly.io)

1. Provision Postgres and Redis, then set every variable from `.env.example`. Set `IP_HASH_SECRET` to a long random string and `NEXT_PUBLIC_SITE_URL` to the public URL (e.g. `https://grab-the-remote.com`), otherwise social previews point to localhost.
2. Build with `pnpm build`, run `pnpm db:migrate` as the pre-deploy step, and start with `pnpm start`. Point the platform health check at `/api/health` (200 when Postgres and Redis answer and the ticker is ticking, 503 otherwise). On `SIGTERM` the server finishes the ticks in flight and closes Redis and Postgres before exiting.
3. Put **Cloudflare** in front with proxied DNS, then lock the origin so `CF-Connecting-IP` can't be spoofed: set `ORIGIN_SECRET` (`openssl rand -base64 32`) and add a Cloudflare Transform Rule (Rules > Transform Rules > Modify request header) that sets `x-origin-secret: <ORIGIN_SECRET>` on every request. The proxy answers 403 to anything without it, except `/api/health`. In production the server refuses to boot without `ORIGIN_SECRET`, or with a `NEXT_PUBLIC_SITE_URL` that isn't `https://`.
4. **Ads:** set `NEXT_PUBLIC_ADS_PROVIDER=adsense` and `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-…`. Turn on the GDPR message in AdSense > Privacy & messaging. `ads.txt` is generated automatically.
5. Fill in `LEGAL` in `src/config/app.ts` (publisher, host, contact email). It feeds `/legal` and `/privacy`.

---

*GrabTheRemote is not affiliated with, endorsed by, or in any way the remote control of YouTube or Google. We just watch a lot of videos.*
