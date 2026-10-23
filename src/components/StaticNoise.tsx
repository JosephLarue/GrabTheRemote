'use client';

import { useEffect, useRef } from 'react';

/** Old-TV snow. Drawn small and scaled up; frozen when the user prefers reduced motion. */
export function StaticNoise({ label }: { label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = ctx.createImageData(canvas.width, canvas.height);
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(draw, 60);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute inset-0 z-10 grid place-items-center">
      <canvas ref={ref} width={160} height={90} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" />
      {label && (
        <p className="font-display sticker relative bg-[var(--ink)] text-lg text-[var(--cream)] sm:text-2xl">{label}</p>
      )}
    </div>
  );
}
