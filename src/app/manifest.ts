import type { MetadataRoute } from 'next';
import { APP_NAME, APP_TAGLINE } from '@/config/app';

// Installable: on a phone's home screen it opens full-screen on the last room visited (/ redirects).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: 'GrabTheRemote',
    description: APP_TAGLINE,
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#6c4df6',
    theme_color: '#6c4df6',
    categories: ['entertainment', 'social', 'games'],
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
