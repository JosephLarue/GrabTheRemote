import { randomUUID } from 'node:crypto';
import { MAX_STREAMS_PER_IP, PRESENCE_WINDOW_S } from '@/config/app';
import { ApiError, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { rateLimit } from '@/server/ratelimit';
import { redis } from '@/server/redis';
import { bus, dropPresence, snapshot, touchPresence } from '@/server/state';
import { touchOnline } from '@/server/steal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRESENCE_EVERY_MS = 10_000;
const HEARTBEAT_EVERY_MS = 15_000;
/** The per-IP stream counter dies with its last presence ping, so a crashed process can't pin it forever. */
const STREAMS_TTL_S = PRESENCE_WINDOW_S * 2;

export async function GET(req: Request) {
  const iph = ipHash(req.headers);
  let room;
  try {
    // Generous: a flapping connection retries every 3 s, and a few tabs may do it at once.
    await rateLimit('stream', iph, 120, 60);
    ({ room } = await openRoom(req, new URL(req.url).searchParams.get('room')));
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
    throw e;
  }

  // A few tabs are fine; a bot holding hundreds of streams open is not. Counted before the stream exists,
  // so a refused caller never costs a subscription.
  const streamsKey = K.streams(iph);
  const open = await redis().incr(streamsKey);
  await redis().expire(streamsKey, STREAMS_TTL_S);
  if (open > MAX_STREAMS_PER_IP) {
    await redis().decr(streamsKey);
    return Response.json({ error: 'rate_limited', message: 'Too many screens open at once 📺📺📺' }, { status: 429 });
  }

  const clientId = randomUUID();
  const ping = () => Promise.all([touchPresence(room, clientId), touchOnline(room, iph), redis().expire(streamsKey, STREAMS_TTL_S)]);
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      // Subscribed before the snapshot is built: whatever changes meanwhile is buffered and sent right after
      // it, so the client never misses an event between "now" and its first picture of the room.
      let buffered: string[] | null = [];
      const onEvent = (msg: string) => {
        if (buffered) buffered.push(msg);
        else send(`data: ${msg}\n\n`);
      };
      bus().on(room, onEvent);

      cleanup = () => {
        bus().off(room, onEvent);
        buffered = null;
        cleanup = () => {};
      };
      req.signal.addEventListener('abort', () => cleanup());

      try {
        await ping();
        const snap = await snapshot(room);
        send(`retry: 3000\ndata: ${JSON.stringify({ type: 'snapshot', data: snap })}\n\n`);
      } catch (e) {
        cleanup();
        redis().decr(streamsKey).catch(() => {});
        throw e;
      }
      const missed = buffered ?? [];
      buffered = null;
      for (const msg of missed) send(`data: ${msg}\n\n`);

      const presence = setInterval(() => ping().catch(() => {}), PRESENCE_EVERY_MS);
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_EVERY_MS);

      cleanup = () => {
        clearInterval(presence);
        clearInterval(heartbeat);
        bus().off(room, onEvent);
        dropPresence(room, clientId).catch(() => {});
        redis().decr(streamsKey).catch(() => {});
        try {
          controller.close();
        } catch {}
        cleanup = () => {};
      };
      if (req.signal.aborted) cleanup();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
