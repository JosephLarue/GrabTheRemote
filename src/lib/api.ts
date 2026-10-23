export type ApiFailure = { error: string; message: string; cooldownEndsAt?: number };

export async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; err: ApiFailure }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return res.ok ? { ok: true, data } : { ok: false, err: data };
  } catch {
    return { ok: false, err: { error: 'network', message: 'Lost the signal. Check your connection and try again 📡' } };
  }
}

// Videos this browser voted for, so we can throw confetti when one of them plays.
const PICKS_KEY = 'gtr:picks';

export function rememberPick(id: string) {
  try {
    const picks: string[] = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]');
    localStorage.setItem(PICKS_KEY, JSON.stringify([id, ...picks.filter((p) => p !== id)].slice(0, 30)));
  } catch {}
}

export function isMyPick(id: string) {
  try {
    return (JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]') as string[]).includes(id);
  } catch {
    return false;
  }
}
