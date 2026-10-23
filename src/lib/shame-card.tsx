import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SHARE_CARD_SIZE } from './share-card';

type ShameCard = {
  wall: string;
  thumbnailUrl: string | null;
  title: string;
  stamp: string;
  headline: string;
  roast: string;
};

const INK = '#1c1236';
const RED = '#ff4a3d';
const CREAM = '#fff6e0';

/** Hall of Shame share card (og:image): the video stamped like a failed exam, the verdict next to it. */
export async function shameCard({ wall, thumbnailUrl, title, stamp, headline, roast }: ShameCard) {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/logo.png'))).toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: wall, padding: 56, gap: 48 }}>
        {/* Rendered by satori, not the browser: next/image doesn't apply. */}
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: 480,
            height: 270,
            flexShrink: 0,
            border: `8px solid ${INK}`,
            borderRadius: 32,
            boxShadow: `14px 14px 0 ${INK}`,
            background: RED,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" width={480} height={270} style={{ objectFit: 'cover', filter: 'grayscale(40%)' }} />
          )}
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              transform: 'rotate(-12deg)',
              background: RED,
              color: INK,
              border: `6px solid ${INK}`,
              borderRadius: 18,
              padding: '8px 28px',
              fontSize: 64,
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            {stamp}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20, color: CREAM }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" width={64} height={64} />
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 900, color: '#ffd23f' }}>HALL OF SHAME</div>
          </div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 900, lineHeight: 1.05 }}>{headline}</div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, opacity: 0.85 }}>{clip(title, 70)}</div>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: CREAM,
              color: RED,
              border: `5px solid ${INK}`,
              borderRadius: 16,
              padding: '8px 18px',
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            “{clip(roast, 60)}”
          </div>
        </div>
      </div>
    ),
    SHARE_CARD_SIZE,
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
