import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { middleware } from './middleware';

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, 'https://app.example'), { headers });
const basic = (password: string) => ({ authorization: `Basic ${btoa(`admin:${password}`)}` });

afterEach(() => vi.unstubAllEnvs());

describe('origin lock', () => {
  it('lets everything through when ORIGIN_SECRET is unset', () => {
    vi.stubEnv('ORIGIN_SECRET', '');
    expect(middleware(req('/api/vote')).status).toBe(200);
  });

  it('rejects requests without the right secret header', () => {
    vi.stubEnv('ORIGIN_SECRET', 'cf-secret');
    expect(middleware(req('/api/vote')).status).toBe(403);
    expect(middleware(req('/api/vote', { 'x-origin-secret': 'nope' })).status).toBe(403);
    expect(middleware(req('/api/vote', { 'x-origin-secret': 'cf-secre' })).status).toBe(403);
    expect(middleware(req('/api/vote', { 'x-origin-secret': 'cf-secret' })).status).toBe(200);
  });

  it('exempts the health check', () => {
    vi.stubEnv('ORIGIN_SECRET', 'cf-secret');
    expect(middleware(req('/api/health')).status).toBe(200);
  });

  it('checks the origin before admin auth', () => {
    vi.stubEnv('ORIGIN_SECRET', 'cf-secret');
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    expect(middleware(req('/admin', basic('pw'))).status).toBe(403);
  });
});

describe('admin auth', () => {
  it('requires the admin password on /admin only', () => {
    vi.stubEnv('ORIGIN_SECRET', '');
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    expect(middleware(req('/admin')).status).toBe(401);
    expect(middleware(req('/admin/x', basic('wrong'))).status).toBe(401);
    expect(middleware(req('/admin', basic('pw'))).status).toBe(200);
    expect(middleware(req('/administrator')).status).toBe(200);
  });
});

describe('room routing', () => {
  const location = (path: string, headers: Record<string, string> = {}) =>
    new URL(middleware(req(path, headers)).headers.get('location') ?? '').pathname;

  it('sends / to the browser language room', () => {
    vi.stubEnv('ORIGIN_SECRET', '');
    expect(location('/', { 'accept-language': 'fr-FR,fr;q=0.9' })).toBe('/fr');
    expect(location('/vote', { 'accept-language': 'it' })).toBe('/it/vote');
    expect(location('/hall', { 'accept-language': 'de' })).toBe('/en/hall');
  });

  it('prefers the last room visited', () => {
    vi.stubEnv('ORIGIN_SECRET', '');
    expect(location('/', { 'accept-language': 'fr', cookie: 'gtr_room=jungle' })).toBe('/jungle');
    expect(location('/', { 'accept-language': 'fr', cookie: 'gtr_room=nope' })).toBe('/fr');
  });

  it('remembers the room being visited', () => {
    vi.stubEnv('ORIGIN_SECRET', '');
    expect(middleware(req('/es/vote')).headers.get('set-cookie')).toContain('gtr_room=es');
    expect(middleware(req('/es', { cookie: 'gtr_room=es' })).headers.get('set-cookie')).toBeNull();
  });

  it('tells pages which room to follow', () => {
    vi.stubEnv('ORIGIN_SECRET', '');
    const room = (path: string, headers: Record<string, string> = {}) =>
      middleware(req(path, headers)).headers.get('x-middleware-request-x-gtr-room');
    expect(room('/it/hall', { cookie: 'gtr_room=fr' })).toBe('it');
    expect(room('/privacy', { cookie: 'gtr_room=es' })).toBe('es');
    expect(room('/legal', { 'accept-language': 'fr' })).toBe('fr');
  });
});
