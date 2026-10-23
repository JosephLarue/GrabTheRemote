import { randomUUID } from 'node:crypto';
import { isRoom } from '@/config/rooms';
import { bus, dropPresence, snapshot, touchPresence } from '@/server/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRESENCE_EVERY_MS = 10_000;
const HEARTBEAT_EVERY_MS = 15_000;

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get('room');
  if (!isRoom(room)) return Response.json({ error: 'bad_room', message: "That room doesn't exist 🚪" }, { status: 400 });
  const clientId = randomUUID();
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

      await touchPresence(room, clientId);
      send(`retry: 3000\ndata: ${JSON.stringify({ type: 'snapshot', data: await snapshot(room) })}\n\n`);
      bus().on(room, onEvent);

      const presence = setInterval(() => touchPresence(room, clientId).catch(() => {}), PRESENCE_EVERY_MS);
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
