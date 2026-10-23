import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { APP_NAME, APP_TAGLINE } from '@/config/app';

export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Share card: the pink TV on grape wallpaper.
export default async function OgImage() {
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
          background: '#6c4df6',
          gap: 24,
        }}
      >
        <img src={logo} alt="" width={120} height={120} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 760,
            height: 360,
            background: '#ff5da2',
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
        <div style={{ display: 'flex', color: '#fff6e0', fontSize: 40, fontWeight: 800 }}>{APP_TAGLINE}</div>
      </div>
    ),
    size,
  );
}
