import { randomUUID } from 'node:crypto';
import { bus, dropPresence, snapshot, touchPresence } from '@/server/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRESENCE_EVERY_MS = 10_000;
const HEARTBEAT_EVERY_MS = 15_000;

export async function GET(req: Request) {
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

      await touchPresence(clientId);
      send(`retry: 3000\ndata: ${JSON.stringify({ type: 'snapshot', data: await snapshot() })}\n\n`);
      bus().on('event', onEvent);

      const presence = setInterval(() => touchPresence(clientId).catch(() => {}), PRESENCE_EVERY_MS);
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_EVERY_MS);

      cleanup = () => {
        clearInterval(presence);
        clearInterval(heartbeat);
        bus().off('event', onEvent);
        dropPresence(clientId).catch(() => {});
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
