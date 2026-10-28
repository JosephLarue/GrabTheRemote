import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { APP_NAME } from '@/config/app';

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

/** Share card (og:image): the TV on the room's wallpaper, the logo above it. */
export async function shareCard({ wall, tv, tagline, sub }: { wall: string; tv: string; tagline: string; sub?: string }) {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/logo.png'))).toString('base64')}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: wall,
          gap: 24,
        }}
      >
        {/* Rendered by satori, not the browser: next/image doesn't apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={120} height={120} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 760,
            height: 360,
            background: tv,
            border: '8px solid #1c1236',
            borderRadius: 60,
            boxShadow: '16px 16px 0 #1c1236',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 660,
              height: 270,
              background: '#1c1236',
              borderRadius: 40,
              color: '#ffd23f',
              fontSize: 84,
              fontWeight: 900,
            }}
          >
            {APP_NAME}
          </div>
        </div>
        <div style={{ display: 'flex', color: '#fff6e0', fontSize: 40, fontWeight: 800 }}>{tagline}</div>
        {sub && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: '#fff6e0',
              color: '#1c1236',
              border: '5px solid #1c1236',
              borderRadius: 999,
              padding: '6px 26px',
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            <span style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: '#ff4a3d' }} />
            {sub}
          </div>
        )}
      </div>
    ),
    SHARE_CARD_SIZE,
  );
}
