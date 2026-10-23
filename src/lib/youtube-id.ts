const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Extracts the 11-char video id from any common YouTube URL shape, or returns null. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (HOSTS.has(host)) {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v|e)\/([^/?#]+)/);
      candidate = m?.[1] ?? null;
    }
  }
  return candidate && ID_RE.test(candidate) ? candidate : null;
}

/** Parses an ISO 8601 duration such as PT1H2M3S or P1DT2H into seconds. */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
