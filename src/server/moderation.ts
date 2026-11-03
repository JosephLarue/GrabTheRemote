import 'server-only';
import { fitsLanguage } from '@/config/rooms';
import type { RoomRules, VideoMeta } from '@/lib/types';
import { db, schema } from './db/client';
import { ApiError } from './http';

const LIST_TTL_MS = 60_000;
let lists: { at: number; channels: Set<string>; keywords: string[] } | undefined;
let staleWarned = false;

async function blocklists() {
  if (!lists || Date.now() - lists.at > LIST_TTL_MS) {
    try {
      const [channels, keywords] = await Promise.all([
        db().select({ id: schema.bannedChannels.channelId }).from(schema.bannedChannels),
        db().select({ k: schema.blockedKeywords.keyword }).from(schema.blockedKeywords),
      ]);
      lists = { at: Date.now(), channels: new Set(channels.map((c) => c.id)), keywords: keywords.map((k) => k.k.toLowerCase()) };
      staleWarned = false;
    } catch (e) {
      // Postgres hiccup: a minute-old blocklist beats refusing every vote and freezing every room.
      if (!lists) throw e;
      if (!staleWarned) {
        staleWarned = true;
        console.error('[moderation] blocklist refresh failed, serving the previous one', e);
      }
      lists.at = Date.now();
    }
  }
  return lists;
}

/** Call after admin edits so changes apply immediately. */
export function invalidateBlocklists() {
  lists = undefined;
  staleWarned = false;
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', it: 'Italian' };

/** Throws a user-facing ApiError if the video is in another language than the room's. */
export function assertFitsRoom(rules: Pick<RoomRules, 'lang'>, m: VideoMeta) {
  if (!fitsLanguage(rules.lang, m.audioLanguage)) {
    const language = LANGUAGE_NAMES[rules.lang!] ?? rules.lang;
    throw new ApiError(422, 'wrong_language', `This is the ${language} room, and this video is in another language. Try The Jungle 🌴`);
  }
}

/** Throws a user-facing ApiError if the video can never be voted for (in a room allowing `maxDurationS`, null for any length). */
export async function assertAllowed(m: VideoMeta, { maxDurationS = null }: { maxDurationS?: number | null } = {}) {
  const reject = (code: string, message: string) => {
    throw new ApiError(422, code, message);
  };
  if (!m.embeddable) reject('not_embeddable', "This video doesn't allow playing outside YouTube. Pick another one 📵");
  if (m.ageRestricted) reject('age_restricted', 'Age-restricted videos are a no-go here 🔞');
  if (m.banned) reject('banned', 'This video is banned from the living room 🚫');
  if (m.flagged) reject('flagged', 'The crowd mass-reported this one. It stays in timeout 🚨');
  if (m.durationS <= 0) reject('live', "Live streams can't grab the remote 📡");
  if (maxDurationS !== null && m.durationS > maxDurationS) {
    reject('too_long', `Too long! Max ${Math.floor(maxDurationS / 60)} minutes, nobody has time for that ⏳`);
  }
  const { channels, keywords } = await blocklists();
  if (channels.has(m.channelId)) reject('banned_channel', 'This channel is banned from the living room 🚫');
  const title = m.title.toLowerCase();
  if (keywords.some((k) => title.includes(k))) reject('blocked_keyword', 'Nope, not that kind of video 🙅');
}

/** Admin bans and title keywords, for a Twitch channel. Bans are stored as `twitch:<login>`. */
export async function streamRefusal(login: string, title: string): Promise<'banned_channel' | 'blocked_keyword' | null> {
  const { channels, keywords } = await blocklists();
  if (channels.has(twitchBanId(login))) return 'banned_channel';
  const t = title.toLowerCase();
  return keywords.some((k) => t.includes(k)) ? 'blocked_keyword' : null;
}

/** The admin's blocked keywords apply to chat messages too. */
export async function chatHasBlockedKeyword(text: string) {
  const { keywords } = await blocklists();
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

export const twitchBanId = (login: string) => `twitch:${login}`;
