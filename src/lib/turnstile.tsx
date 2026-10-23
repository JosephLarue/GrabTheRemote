'use client';

import { useCallback, useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileLoading?: Promise<void>;
  }
}

function loadScript() {
  window.__turnstileLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile load failed'));
    document.head.appendChild(s);
  });
  return window.__turnstileLoading;
}

/**
 * Invisible-until-needed captcha. Render `<div ref={ref} />` somewhere, then
 * `await getToken()` right before each protected POST (tokens are single-use).
 */
export function useTurnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pending = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: (token: string) => {
            pending.current?.resolve(token);
            pending.current = null;
          },
          'error-callback': () => {
            pending.current?.reject(new Error('captcha'));
            pending.current = null;
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  const getToken = useCallback(async () => {
    await loadScript();
    for (let i = 0; i < 40 && !widget.current; i++) await new Promise((r) => setTimeout(r, 50));
    const id = widget.current;
    if (!id || !window.turnstile) throw new Error('captcha');
    window.turnstile.reset(id);
    const token = new Promise<string>((resolve, reject) => (pending.current = { resolve, reject }));
    window.turnstile.execute(id);
    return token;
  }, []);

  return { ref, getToken };
}
