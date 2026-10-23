import 'server-only';
import { ApiError } from './http';
import { K } from './keys';
import { redis } from './redis';

/** Fixed-window limiter: at most `max` hits per `windowS` per IP hash. */
export async function rateLimit(bucket: string, iph: string, max: number, windowS: number) {
  const key = K.rate(bucket, iph);
  const [[, count]] = (await redis().multi().incr(key).expire(key, windowS, 'NX').exec()) as [[null, number]];
  if (count > max) throw new ApiError(429, 'rate_limited', 'Whoa, slow down! Too many button mashes 🫨');
}
