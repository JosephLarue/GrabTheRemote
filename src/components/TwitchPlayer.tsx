'use client';

import { useClientValue } from '@/lib/use-client-value';

const hostname = () => window.location.hostname;

/**
 * Twitch's embedded player. No click shield on top (unlike YouTube): Twitch's own controls stay usable,
 * including unmute. `parent` must be the page's host, which only the browser knows.
 */
export function TwitchPlayer({ login, overlay }: { login: string | null; overlay?: React.ReactNode }) {
  const host = useClientValue(hostname, null);

  return (
    <div className="tv-screen">
      {login && host && (
        <iframe
          key={login}
          src={`https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${encodeURIComponent(host)}&muted=true&autoplay=true`}
          title={`${login} on Twitch`}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="tv-player"
        />
      )}
      {overlay}
    </div>
  );
}
