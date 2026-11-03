'use client';

// One-shot visual effects, done imperatively on the DOM so no component has to carry their state:
// the remote's infrared beam, the TV shattering, a quick flash. Styles live in globals.css (.fx-*).

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const screen = () => document.querySelector<HTMLElement>('.tv-screen');

/** A dashed beam from `from` to `to` (default: the TV screen), and the target flashes. */
export function beam(from: Element | null | undefined, to: Element | null | undefined = screen()) {
  if (!from || !to) return;
  if (!reducedMotion()) {
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const x1 = a.left + a.width / 2;
    const y1 = a.top + a.height / 2;
    const x2 = b.left + b.width / 2;
    const y2 = b.top + b.height / 2;
    const el = document.createElement('div');
    el.className = 'fx-beam';
    el.style.left = `${x1}px`;
    el.style.top = `${y1}px`;
    el.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
    el.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }
  flash(to, 'fx-hit', 700);
}

/** Adds a class for `ms`, restarting the animation if it was already there. */
export function flash(el: Element | null | undefined, cls: string, ms: number) {
  if (!el) return;
  el.classList.remove(cls);
  // Force a reflow so re-adding the class restarts the animation.
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/**
 * Analog snow: static grain over the picture (the video keeps playing under it), a bright band rolling down,
 * fading out at the end. Reduced motion: one still frame of faint grain.
 */
export function tvSnow(ms: number) {
  const tv = screen();
  if (!tv) return;
  const still = reducedMotion();
  const canvas = document.createElement('canvas');
  canvas.className = 'egg-static';
  canvas.width = 192;
  canvas.height = 108;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d = img.data;
  let band = 0;
  const draw = (alpha: number) => {
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = alpha * 255;
    }
    ctx.putImageData(img, 0, 0);
    if (still) return;
    // The rolling band: a brighter stripe sweeping down, like a weak signal.
    band = (band + 3) % (canvas.height + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, band - 10, canvas.width, 10);
  };
  draw(still ? 0.4 : 0.75);
  tv.appendChild(canvas);
  if (still) {
    setTimeout(() => canvas.remove(), ms);
    return;
  }
  const t0 = performance.now();
  const timer = setInterval(() => {
    const k = (performance.now() - t0) / ms;
    // Strong at first, settling, then clearing up in the last third.
    const alpha = k < 0.15 ? 0.85 : k < 0.66 ? 0.55 : 0.55 * (1 - (k - 0.66) / 0.34);
    draw(Math.max(0, alpha));
  }, 50);
  flash(tv, 'egg-static-jolt', 500);
  setTimeout(() => {
    clearInterval(timer);
    canvas.remove();
  }, ms);
}

/** The TV screen explodes into tiles of `thumbnailUrl` (the video that just got vetoed). */
export function shatter(thumbnailUrl?: string) {
  const tv = screen();
  if (!tv) return;
  if (reducedMotion() || !thumbnailUrl) {
    flash(tv, 'fx-hit', 700);
    return;
  }
  const rect = tv.getBoundingClientRect();
  const cols = 10;
  const rows = 6;
  const wrap = document.createElement('div');
  wrap.className = 'fx-shatter';
  wrap.style.left = `${rect.left}px`;
  wrap.style.top = `${rect.top}px`;
  wrap.style.width = `${rect.width}px`;
  wrap.style.height = `${rect.height}px`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('div');
      const dx = c - (cols - 1) / 2;
      const dy = r - (rows - 1) / 2;
      const dist = Math.hypot(dx / cols, dy / rows);
      tile.style.left = `${(c / cols) * 100}%`;
      tile.style.top = `${(r / rows) * 100}%`;
      tile.style.width = `${100 / cols}%`;
      tile.style.height = `${100 / rows}%`;
      tile.style.backgroundImage = `url("${thumbnailUrl}")`;
      tile.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
      tile.style.backgroundPosition = `${(c / (cols - 1)) * 100}% ${(r / (rows - 1)) * 100}%`;
      tile.style.setProperty('--dx', `${dx * 60 + (Math.random() - 0.5) * 80}px`);
      tile.style.setProperty('--dy', `${dy * 60 + 120 + Math.random() * 160}px`);
      tile.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
      tile.style.animationDelay = `${dist * 180}ms`;
      wrap.appendChild(tile);
    }
  }
  document.body.appendChild(wrap);
  flash(tv, 'fx-crack', 400);
  setTimeout(() => wrap.remove(), 1400);
}
