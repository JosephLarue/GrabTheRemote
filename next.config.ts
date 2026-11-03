import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory confuses Next's workspace-root detection.
  outputFileTracingRoot: path.join(__dirname),
  images: { remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com' }] },
  poweredByHeader: false,
  // Browser-side hardening on every response. No CSP: the YouTube/Twitch embeds and the ads provider
  // would need a policy of their own, and a wrong one breaks the screen silently.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
