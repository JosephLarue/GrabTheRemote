import { NextResponse, type NextRequest } from 'next/server';
import { ROOM_COOKIE, ROOM_HEADER, isRoom, roomFromAcceptLanguage } from '@/config/rooms';

// Railway/Fly health checks hit the origin directly, without going through Cloudflare.
const ORIGIN_LOCK_EXEMPT = ['/api/health'];

/** Constant-time string compare (no node:crypto in the edge runtime). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return diff === 0;
}

// Origin lock: Cloudflare adds x-origin-secret (Transform Rule) to every request it proxies. Without it,
// anyone calling the *.up.railway.app URL directly could spoof CF-Connecting-IP and vote forever.
// Disabled when ORIGIN_SECRET is unset (local dev).
function originAllowed(req: NextRequest): boolean {
  const secret = process.env.ORIGIN_SECRET;
  if (!secret || ORIGIN_LOCK_EXEMPT.includes(req.nextUrl.pathname)) return true;
  return safeEqual(req.headers.get('x-origin-secret') ?? '', secret);
}

// HTTP basic auth for /admin (server actions post to the same path, so they're covered too).
function adminAllowed(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const header = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (!expected || scheme !== 'Basic' || !encoded) return false;
  const decoded = atob(encoded);
  return safeEqual(decoded.slice(decoded.indexOf(':') + 1), expected);
}

// Room-less entry points: send people to their last room, else the one matching their browser language.
const ROOM_ENTRY = ['/', '/vote', '/hall'];
const ROOM_COOKIE_MAX_AGE_S = 365 * 86400;

function rooms(req: NextRequest): NextResponse {
  const path = req.nextUrl.pathname;
  const saved = req.cookies.get(ROOM_COOKIE)?.value;
  const fallback = isRoom(saved) ? saved : roomFromAcceptLanguage(req.headers.get('accept-language'));
  if (ROOM_ENTRY.includes(path)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${fallback}${path === '/' ? '' : path}`;
    return NextResponse.redirect(url);
  }
  // Pages outside a room (/privacy, /legal) follow the last room visited.
  const first = path.split('/')[1];
  const headers = new Headers(req.headers);
  headers.set(ROOM_HEADER, isRoom(first) ? first : fallback);
  const res = NextResponse.next({ request: { headers } });
  if (isRoom(first) && saved !== first) {
    res.cookies.set(ROOM_COOKIE, first, { path: '/', maxAge: ROOM_COOKIE_MAX_AGE_S, sameSite: 'lax' });
  }
  return res;
}

export function middleware(req: NextRequest) {
  if (!originAllowed(req)) return new NextResponse('Forbidden', { status: 403 });
  const path = req.nextUrl.pathname;
  if ((path === '/admin' || path.startsWith('/admin/')) && !adminAllowed(req)) {
    return new NextResponse('Admins only 🔒', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Grab The Remote admin", charset="UTF-8"' },
    });
  }
  return rooms(req);
}

// Everything except build assets, which are public anyway.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
