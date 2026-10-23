import 'server-only';
import { createHmac } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { env } from './env';

/**
 * Client IP. In production the origin only accepts traffic from Cloudflare, so CF-Connecting-IP
 * is trustworthy. X-Forwarded-For is a fallback for local dev and PaaS proxies.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function expandV6(ip: string): string[] {
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = ip.includes('::') ? Array(8 - h.length - t.length).fill('0') : [];
  return [...h, ...fill, ...t].map((g) => g.padStart(4, '0').toLowerCase());
}

/** IPv4 → full address; IPv6 → its /64 prefix (one household/device typically owns a whole /64). */
export function ipKey(ip: string): string {
  const bare = ip.replace(/^\[|\]$/g, '').split('%')[0];
  if (bare.startsWith('::ffff:') && bare.includes('.')) return bare.slice(7);
  if (!isIPv6(bare)) return bare;
  return `${expandV6(bare).slice(0, 4).join(':')}::/64`;
}

export function ipHash(headers: Headers): string {
  return createHmac('sha256', env().IP_HASH_SECRET).update(ipKey(clientIp(headers))).digest('base64url').slice(0, 22);
}
