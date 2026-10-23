import 'server-only';
import { env } from './env';
import { ApiError } from './http';
import { clientIp } from './ip';

export async function verifyTurnstile(token: unknown, headers: Headers) {
  if (typeof token !== 'string' || !token) {
    throw new ApiError(400, 'captcha', 'Prove you are not a robot first 🤖');
  }
  const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET, response: token, remoteip: clientIp(headers) });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = (await res.json()) as { success: boolean };
  if (!data.success) throw new ApiError(403, 'captcha', 'The robot detector says beep boop. Try again 🤖');
}
