import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { APP_NAME } from '@/config/app';
import { FOIL, type Rarity } from './cards';

export const CARD_SIZE = { width: 600, height: 840 };

type Card = {
  thumbnailUrl: string | null;
  title: string;
  stamp: string;
  headline: string;
  roast: string;
  rarity: Rarity;
  rarityLabel: string;
  serial: string;
  room: string;
  lasted: string;
};

const INK = '#1c1236';
const RED = '#ff4a3d';
const CREAM = '#fff6e0';

/** A Hall of Shame trading card as a PNG: the same layout as the on-page card, made to be downloaded. */
export async function cardImage(c: Card) {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/logo.png'))).toString('base64')}`;
  const [a, b, d] = FOIL[c.rarity];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 18,
          background: `linear-gradient(135deg, ${a}, ${b}, ${d})`,
          border: `8px solid ${INK}`,
          borderRadius: 40,
          color: INK,
          fontWeight: 900,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: CREAM,
            border: `6px solid ${INK}`,
            borderRadius: 28,
            padding: 22,
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" width={44} height={44} />
              <div style={{ display: 'flex', fontSize: 22 }}>HALL OF SHAME</div>
            </div>
            <div
              style={{
                display: 'flex',
                background: `linear-gradient(90deg, ${a}, ${d})`,
                border: `4px solid ${INK}`,
                borderRadius: 999,
                padding: '4px 16px',
                fontSize: 20,
                textTransform: 'uppercase',
              }}
            >
              {c.rarityLabel}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: '100%',
              height: 283,
              border: `6px solid ${INK}`,
              borderRadius: 22,
              background: RED,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {c.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.thumbnailUrl} alt="" width={504} height={283} style={{ objectFit: 'cover', filter: 'grayscale(40%)' }} />
            ) : (
              <div style={{ display: 'flex', fontSize: 120 }}>🚨</div>
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
                padding: '6px 24px',
                fontSize: 54,
                textTransform: 'uppercase',
              }}
            >
              {c.stamp}
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.15 }}>{clip(c.title, 60)}</div>
          <div style={{ display: 'flex', fontSize: 36, lineHeight: 1.05 }}>{c.headline}</div>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: INK,
              color: CREAM,
              borderRadius: 14,
              padding: '8px 16px',
              fontSize: 22,
            }}
          >
            “{clip(c.roast, 52)}”
          </div>

          <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'space-between', fontSize: 18, opacity: 0.8 }}>
            <div style={{ display: 'flex' }}>{c.room}</div>
            <div style={{ display: 'flex' }}>{c.lasted}</div>
            <div style={{ display: 'flex' }}>{c.serial}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 16, opacity: 0.6 }}>{APP_NAME}</div>
        </div>
      </div>
    ),
    CARD_SIZE,
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
