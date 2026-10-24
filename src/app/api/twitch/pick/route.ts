import { parseTwitchLogin } from '@/lib/twitch';
import { ApiError, handle, ok, twitchRoomOf } from '@/server/http';
import { ipHash } from '@/server/ip';
import { rateLimit } from '@/server/ratelimit';
import { verifyTurnstile } from '@/server/turnstile';
import { votePick } from '@/server/twitch';
import { TwitchUnavailableError } from '@/server/twitch-api';

export const dynamic = 'force-dynamic';

const REFUSALS = {
  closed: [409, 'pick_closed', 'Too late, the pick window is closed ⏳'],
  already: [409, 'already_picked', 'You already picked one this round 🗳️'],
  current: [409, 'pick_current', "That's the stream that just got voted off 😅"],
  offline: [422, 'offline', "That channel isn't live right now 📴"],
  mature: [422, 'mature', 'That stream is for mature audiences, not for this couch 🔞'],
  banned_channel: [422, 'banned_channel', 'This channel is banned from the living room 🚫'],
  blocked_keyword: [422, 'blocked_keyword', 'Nope, not that kind of stream 🙅'],
} as const;

/** Vote for the next stream, while the pick window is open. One pick per connection per round. */
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('twitch-pick', iph, 20, 60);
  const body = (await req.json().catch(() => ({}))) as { room?: string; channel?: string; token?: string };
  const room = twitchRoomOf(body.room);
  const login = parseTwitchLogin(body.channel ?? '');
  if (!login) throw new ApiError(400, 'bad_channel', "That's not a Twitch channel we recognize 🤔");
  await verifyTurnstile(body.token, req.headers);

  let result;
  try {
    result = await votePick(room, iph, login);
  } catch (e) {
    if (e instanceof TwitchUnavailableError) {
      throw new ApiError(503, 'twitch_down', "Can't reach Twitch right now. Try again in a sec 📡");
    }
    throw e;
  }
  if (result.status !== 'ok') {
    const [status, code, message] = REFUSALS[result.status];
    throw new ApiError(status, code, message);
  }
  return ok({ ok: true, channel: result.channel });
});
