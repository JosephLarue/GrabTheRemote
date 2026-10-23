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

Five screens, five crowds: 🇬🇧 **English** (`/en`), 🇫🇷 **Français** (`/fr`), 🇪🇸 **Español** (`/es`), 🇮🇹 **Italiano** (`/it`) and 🌴 **The Jungle** (`/jungle`), where anything goes. Each room has its own queue, its own remote, its own vote cooldown and its own Hall of Fame. Themes are shared.

Landing on `/` takes you back to your last room, or to the one matching your browser language.

## 🎲 Theme roulette

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

## 🏆 Hall of Fame (and Shame)

- **Most watched** — the crowd's all-time favorites
- **Most picked** — the videos that keep coming back
- **Biggest landslide** — the most votes for a single pick
- **Peak crowd** — the biggest audience ever in the room
- **Hall of Shame** — fastest skips and mass-reported disasters. Legends, in their own way.

## 🔊 "Why is it muted?!"

Browsers hate surprise noise. Click the giant wobbling **CRANK IT UP 🔊** sticker once and you're in.

## 🙅 No accounts. Ever.

No sign-up, no password, no "verify your email". Just show up and grab the remote. Votes are tied to a scrambled (hashed) version of your IP, never the real thing, and a quick captcha keeps the robots off the couch. 🤖🚫

## 📜 House rules

- Embeddable YouTube videos only, 15 minutes max
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
- **Cloudflare Turnstile** to stop the bots
- **YouTube IFrame + Data API** (with aggressive caching, because quota is precious)

### Run it locally

You need Node 20+, pnpm and Docker.

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
- **Tests:** `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- **Encrypted env:** `.env.local.enc` is committed; the key is not. With the key in `.env.key` (or `ENV_KEY`), run `pnpm env:decrypt` to restore `.env.local`. After editing it, run `pnpm env:encrypt` and commit the `.enc`. First time: `pnpm env:keygen`.

### How it fits together

| Piece | Where |
|---|---|
| Every tunable number (cooldowns, thresholds, quota limits) | `src/config/app.ts` |
| Themes | `src/config/constraints.ts` |
| Rooms (list, names, browser-language pick) | `src/config/rooms.ts`, routing in `src/middleware.ts`, pages in `src/app/[room]` |
| Playback ticker, queue advance, per-room lock | `src/server/engine.ts`, started from `src/instrumentation.ts` |
| Live state, SSE fan-out, viewer presence | `src/server/state.ts`, `src/app/api/stream` |
| YouTube metadata cache (Redis → Postgres → API) and quota guard | `src/server/youtube.ts` |
| Moderation filters | `src/server/moderation.ts` |
| Redis keys | `src/server/keys.ts` |

The ticker needs a **long-running Node process** (not serverless). Run a single instance; several work too, since the Redis lock ensures only one advances playback.

### Deploying (Railway or Fly.io)

1. Provision Postgres and Redis, then set every variable from `.env.example`. Set `IP_HASH_SECRET` to a long random string and `NEXT_PUBLIC_SITE_URL` to the public URL (e.g. `https://grabtheremote.com`), otherwise social previews point to localhost.
2. Build with `pnpm build`, run `pnpm db:migrate` as the pre-deploy step, and start with `pnpm start`. Point the platform health check at `/api/health` (200 when Postgres and Redis answer, 503 otherwise).
3. Put **Cloudflare** in front with proxied DNS, then lock the origin so `CF-Connecting-IP` can't be spoofed: set `ORIGIN_SECRET` (`openssl rand -base64 32`) and add a Cloudflare Transform Rule (Rules > Transform Rules > Modify request header) that sets `x-origin-secret: <ORIGIN_SECRET>` on every request. The middleware answers 403 to anything without it, except `/api/health`.
4. **Ads:** set `NEXT_PUBLIC_ADS_PROVIDER=adsense` and `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-…`. Turn on the GDPR message in AdSense > Privacy & messaging. `ads.txt` is generated automatically.
5. Fill in `LEGAL` in `src/config/app.ts` (publisher, host, contact email). It feeds `/legal` and `/privacy`.

---

*GrabTheRemote is not affiliated with, endorsed by, or in any way the remote control of YouTube or Google. We just watch a lot of videos.*
