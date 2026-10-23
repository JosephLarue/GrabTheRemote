import 'server-only';
import { NextResponse } from 'next/server';
import { isRoom, isTwitchRoom, type RoomId } from '@/config/rooms';

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
