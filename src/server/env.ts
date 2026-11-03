import 'server-only';
import { z } from 'zod';

const production = process.env.NODE_ENV === 'production';

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    YT_API_KEY: z.string().optional().default(''),
    // Twitch app (dev.twitch.tv). Without it, any channel name is accepted and assumed live (dev only).
    TWITCH_CLIENT_ID: z.string().optional().default(''),
    TWITCH_CLIENT_SECRET: z.string().optional().default(''),
    IP_HASH_SECRET: z.string().min(16),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
    TURNSTILE_SECRET: z.string().min(1),
    ADMIN_PASSWORD: z.string().min(1),
    // The proxy reads these two from process.env itself; they're only validated here.
    ORIGIN_SECRET: z.string().optional().default(''),
    NEXT_PUBLIC_SITE_URL: z.string().optional().default(''),
  })
  .superRefine((e, ctx) => {
    if (!production) return;
    // Without the origin lock, anyone hitting the Railway URL directly can spoof CF-Connecting-IP.
    if (!e.ORIGIN_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['ORIGIN_SECRET'], message: 'Required in production (see README: origin lock)' });
    }
    if (!e.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SITE_URL'], message: 'Must start with https:// in production' });
    }
  });

let cached: z.infer<typeof schema> | undefined;

/** Validated environment. Throws with a readable list of problems; `register()` calls it at boot to fail fast. */
export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
      throw new Error(`Invalid environment:\n${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}
