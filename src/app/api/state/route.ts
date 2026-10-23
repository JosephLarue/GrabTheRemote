import { handle, ok } from '@/server/http';
import { snapshot } from '@/server/state';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok(await snapshot()));
