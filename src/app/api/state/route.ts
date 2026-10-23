import { handle, ok, roomFromUrl } from '@/server/http';
import { snapshot } from '@/server/state';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => ok(await snapshot(roomFromUrl(req))));
