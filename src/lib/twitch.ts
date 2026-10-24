import { TWITCH_CLOSE_GAP } from '@/config/app';
import type { TwitchLive } from './types';

const LOGIN = /^[a-z0-9_]{3,25}$/;

/** Channel login from what people paste: "name", "@name", "twitch.tv/name", "https://m.twitch.tv/name?x". */
export function parseTwitchLogin(input: string): string | null {
  let s = input.trim();
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|m\.|go\.)?twitch\.tv\/([^/?#\s]+)/i);
  if (url) s = url[1];
  else if (s.includes('/') || s.includes('.')) return null;
  s = s.replace(/^@/, '').toLowerCase();
  return LOGIN.test(s) ? s : null;
}

export const twitchUrl = (login: string) => `https://www.twitch.tv/${login}`;

/** Keep vs change within a vote or so of each other, with people actually voting. */
export const isCloseCall = ({ keep, change }: TwitchLive['tally']) =>
  keep + change >= 2 && Math.abs(keep - change) <= TWITCH_CLOSE_GAP;
