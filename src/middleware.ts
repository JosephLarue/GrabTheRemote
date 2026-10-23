import { NextResponse, type NextRequest } from 'next/server';

// HTTP basic auth for /admin (server actions post to the same path, so they're covered too).
export function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  const header = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (expected && scheme === 'Basic' && encoded) {
    const decoded = atob(encoded);
    const password = decoded.slice(decoded.indexOf(':') + 1);
    if (password === expected) return NextResponse.next();
  }
  return new NextResponse('Admins only 🔒', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Grab The Remote admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ['/admin/:path*'] };
