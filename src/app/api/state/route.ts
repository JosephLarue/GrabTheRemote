import { handle, ok, openRoom } from '@/server/http';
import { snapshot } from '@/server/state';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => ok(await snapshot((await openRoom(req, new URL(req.url).searchParams.get('room'))).room)));
