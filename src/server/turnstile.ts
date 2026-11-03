import 'server-only';
import { UPSTREAM_TIMEOUT_MS } from '@/config/app';
import { env } from './env';
import { ApiError } from './http';
import { clientIp } from './ip';

export async function verifyTurnstile(token: unknown, headers: Headers) {
  if (typeof token !== 'string' || !token) {
    throw new ApiError(400, 'captcha', 'Prove you are not a robot first 🤖');
  }
  const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET, response: token, remoteip: clientIp(headers) });
  let data: { success: boolean };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    data = (await res.json()) as { success: boolean };
  } catch (e) {
    // Cloudflare slow or down: nobody is let through unverified, but it's their outage, not the user's fault.
    console.error('[turnstile] verification unavailable', e);
    throw new ApiError(503, 'captcha_unavailable', 'The robot detector is napping. Try again in a moment 😴');
  }
  if (!data.success) throw new ApiError(403, 'captcha', 'The robot detector says beep boop. Try again 🤖');
}
