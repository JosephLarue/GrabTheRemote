import { randomUUID } from 'node:crypto';
import { ApiError, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { bus, dropPresence, snapshot, touchPresence } from '@/server/state';
import { touchOnline } from '@/server/steal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRESENCE_EVERY_MS = 10_000;
const HEARTBEAT_EVERY_MS = 15_000;

export async function GET(req: Request) {
  let room;
  try {
    ({ room } = await openRoom(req, new URL(req.url).searchParams.get('room')));
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
    throw e;
  }
  const clientId = randomUUID();
  const iph = ipHash(req.headers);
  const ping = () => Promise.all([touchPresence(room, clientId), touchOnline(room, iph)]);
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
      const onEvent = (msg: string) => send(`data: ${msg}\n\n`);

      await ping();
      send(`retry: 3000\ndata: ${JSON.stringify({ type: 'snapshot', data: await snapshot(room) })}\n\n`);
      bus().on(room, onEvent);

      const presence = setInterval(() => ping().catch(() => {}), PRESENCE_EVERY_MS);
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_EVERY_MS);

      cleanup = () => {
        clearInterval(presence);
        clearInterval(heartbeat);
        bus().off(room, onEvent);
        dropPresence(room, clientId).catch(() => {});
        try {
          controller.close();
        } catch {}
        cleanup = () => {};
      };
      req.signal.addEventListener('abort', () => cleanup());
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
