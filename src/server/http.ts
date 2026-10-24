import 'server-only';
import { NextResponse } from 'next/server';
import { isRoom, isTwitchRoom, type RoomId } from '@/config/rooms';
import type { RoomSettings } from '@/lib/types';
import { type Access, accessOf, requestCookie } from './private-rooms';
import { roomSettings } from './room-settings';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Validates a room id from a query param or JSON body. */
export function roomOf(value: unknown): RoomId {
  if (!isRoom(value)) throw new ApiError(400, 'bad_room', "That room doesn't exist 🚪");
  return value;
}

/** A room that plays YouTube videos: the queue, skip, report and veto routes don't apply to Twitch rooms. */
export function youtubeRoomOf(value: unknown): RoomId {
  const room = roomOf(value);
  if (isTwitchRoom(room)) throw new ApiError(400, 'bad_room', 'This room plays Twitch streams 🟣');
  return room;
}

/** A Twitch room. */
export function twitchRoomOf(value: unknown): RoomId {
  const room = roomOf(value);
  if (!isTwitchRoom(room)) throw new ApiError(400, 'bad_room', "This room doesn't play Twitch streams 🚪");
  return room;
}

/**
 * A room the caller may use: it exists, and for a private room they entered its password (or own it).
 * `kind` narrows to YouTube or Twitch rooms; `owner` requires the streamer who made the room.
 */
export async function openRoom(
  req: Request,
  value: unknown,
  opts: { kind?: 'youtube' | 'twitch'; owner?: boolean } = {},
): Promise<{ room: RoomId; settings: RoomSettings; access: Access }> {
  const room = opts.kind === 'youtube' ? youtubeRoomOf(value) : opts.kind === 'twitch' ? twitchRoomOf(value) : roomOf(value);
  const access = await accessOf(room, requestCookie(req));
  const settings = access.exists ? await roomSettings(room) : null;
  if (!settings) throw new ApiError(404, 'room_gone', 'This room is closed 🚪');
  if (!access.enter) throw new ApiError(403, 'locked', 'This room is private. Enter its password first 🔒');
  if (opts.owner && !access.owner) throw new ApiError(403, 'not_owner', 'Only the streamer can do that 🎙️');
  return { room, settings, access };
}

/** Room from the `?room=` query param of a GET request. */
export const roomFromUrl = (req: Request) => roomOf(new URL(req.url).searchParams.get('room'));

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

/** Wraps a route handler so thrown ApiErrors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.code, message: e.message, ...e.extra }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json(
        { error: 'internal', message: 'The remote fell behind the couch. Try again in a sec.' },
        { status: 500 },
      );
    }
  };
}
