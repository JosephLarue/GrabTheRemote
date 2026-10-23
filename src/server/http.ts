import 'server-only';
import { NextResponse } from 'next/server';

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
