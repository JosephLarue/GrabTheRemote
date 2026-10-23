import 'server-only';
import { NextResponse } from 'next/server';
import { isRoom, type RoomId } from '@/config/rooms';

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
