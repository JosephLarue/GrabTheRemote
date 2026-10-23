import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory confuses Next's workspace-root detection.
  outputFileTracingRoot: path.join(__dirname),
  images: { remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com' }] },
};

export default nextConfig;
