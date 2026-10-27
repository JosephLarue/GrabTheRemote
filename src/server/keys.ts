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
  /** Last chat messages (JSON), newest first; expires an hour after the last one. */
  chat: (room: RoomId) => r(room, 'chat'),
  hallCache: (room: RoomId, tab: string) => r(room, `hall:${tab}`),
  /** IP hashes watching right now (score: last presence ping), so the stolen remote goes to someone here. */
  online: (room: RoomId) => r(room, 'online'),
  /** IP hashes that voted (score: last vote). */
  voters: (room: RoomId) => r(room, 'voters'),
  /** IP hash holding the stolen remote; expires with the veto. */
  steal: (room: RoomId) => r(room, 'steal'),
  /** When this period's remote gets stolen (ms), then whether it was drawn. */
  stealAt: (room: RoomId, period: number) => r(room, `steal:at:${period}`),
  stealDrawn: (room: RoomId, period: number) => r(room, `steal:drawn:${period}`),
  /** Twitch room: the stream and phase (JSON), then per round: keep/change votes, pick votes, who picked. */
  twitch: (room: RoomId) => r(room, 'twitch'),
  twitchDirty: (room: RoomId) => r(room, 'twitch:dirty'),
  twitchDecide: (room: RoomId, round: number) => r(room, `twitch:decide:${round}`),
  twitchPick: (room: RoomId, round: number) => r(room, `twitch:pick:${round}`),
  twitchPickInfo: (room: RoomId, round: number) => r(room, `twitch:pick:info:${round}`),
  twitchPicked: (room: RoomId, round: number) => r(room, `twitch:picked:${round}`),
  /** Channels that played here, latest first: the pick window's suggestions. */
  twitchRecent: (room: RoomId) => r(room, 'twitch:recent'),
  twitchToken: 'twitch:token',
  /** Private room: settings, password and owner key hash (JSON). Expires after a day with nobody watching. */
  privateRoom: (room: RoomId) => `private:${room}`,
  /** Ids of every private room, so the ticker knows what to run. */
  privateRooms: 'private:rooms',
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
