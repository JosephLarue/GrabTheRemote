import type { RoomId } from '@/config/rooms';

// Every Redis key in one place. Never put raw IPs in a key: use the HMAC (`iph`).
// Live state is per room (`room:<id>:…`); video metadata, quota, themes and rate limits are shared.
const r = (room: RoomId, key: string) => `room:${room}:${key}`;

export const K = {
  pool: (room: RoomId) => r(room, 'pool'),
  poolFirst: (room: RoomId) => r(room, 'pool:first'),
  poolLast: (room: RoomId) => r(room, 'pool:last'),
  poolDirty: (room: RoomId) => r(room, 'pool:dirty'),
  voteCd: (room: RoomId, iph: string) => r(room, `votecd:${iph}`),
  nowPlaying: (room: RoomId) => r(room, 'nowplaying'),
  skipCd: (room: RoomId) => r(room, 'skip:cd'),
  presence: (room: RoomId) => r(room, 'presence'),
  lockAdvance: (room: RoomId) => r(room, 'lock:advance'),
  hallCache: (room: RoomId, tab: string) => r(room, `hall:${tab}`),
  // Play ids are unique across rooms, so these need no room prefix.
  skipVotes: (playId: number) => `skip:${playId}`,
  reportVotes: (playId: number) => `report:${playId}`,
  theme: (slotId: number) => `theme:${slotId}`,
  themeWeights: 'theme:weights',
  ytCache: (id: string) => `yt:cache:${id}`,
  ytQuota: (day: string) => `yt:quota:${day}`,
  rate: (bucket: string, iph: string) => `rate:${bucket}:${iph}`,
  /** Single pub/sub channel; each message is `<room>|<json event>`. */
  events: 'events',
} as const;
