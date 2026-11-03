import { ImageResponse } from 'next/og';
import { APP_NAME } from '@/config/app';
import { cardAssets, cardFonts } from './fonts';

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

const INK = '#1c1236';
const CREAM = '#fff6e0';
const YELLOW = '#ffd23f';
const RED = '#ff4a3d';

type ShareCard = {
  /** Wallpaper colour. */
  wall: string;
  /** TV colour. */
  tv: string;
  tagline: string;
  /** Live line under the TV, e.g. "12 on the couch right now". */
  sub?: string;
};

/**
 * Share card (og:image): a chunky 70s TV on the room's wallpaper, the logo and the name on screen, the tagline
 * under it. Everything that matters sits in the middle 630px, so a square crop (Slack, WhatsApp) keeps the TV.
 */
export async function shareCard({ wall, tv, tagline, sub }: ShareCard) {
  const assets = await cardAssets();
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
          backgroundColor: wall,
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.07) 0 18%, transparent 19%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.07) 0 18%, transparent 19%)',
          backgroundSize: '72px 72px',
          fontFamily: 'Nunito',
          color: CREAM,
        }}
      >
        {/* Spotlight on the TV, darker edges. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            backgroundImage: 'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        {/* Rabbit ears. */}
        <div style={{ display: 'flex', position: 'relative', width: 200, height: 70, marginBottom: -12 }}>
          <div
            style={{
              position: 'absolute',
              left: 92,
              top: 0,
              width: 10,
              height: 90,
              background: INK,
              borderRadius: 5,
              transform: 'rotate(28deg)',
              transformOrigin: 'bottom center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 98,
              top: 0,
              width: 10,
              height: 90,
              background: INK,
              borderRadius: 5,
              transform: 'rotate(-28deg)',
              transformOrigin: 'bottom center',
            }}
          />
          <div style={{ position: 'absolute', left: 54, top: -10, width: 20, height: 20, borderRadius: 10, background: RED, border: `4px solid ${INK}` }} />
          <div style={{ position: 'absolute', left: 126, top: -10, width: 20, height: 20, borderRadius: 10, background: YELLOW, border: `4px solid ${INK}` }} />
        </div>

        {/* The TV. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            padding: 24,
            background: tv,
            border: `8px solid ${INK}`,
            borderRadius: 44,
            boxShadow: `16px 16px 0 ${INK}`,
          }}
        >
          {/* Screen. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: 500,
              height: 316,
              background: INK,
              backgroundImage: 'radial-gradient(ellipse at 50% 40%, #35256b 0%, #1c1236 70%)',
              border: `6px solid ${INK}`,
              borderRadius: 34,
              boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.08), inset 0 0 60px rgba(0,0,0,0.6)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Scanlines. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0 2px, transparent 2px 6px)',
              }}
            />
            {/* Glare. */}
            <div
              style={{
                position: 'absolute',
                left: 24,
                top: 18,
                width: 170,
                height: 80,
                display: 'flex',
                borderRadius: 60,
                background: 'rgba(255,255,255,0.09)',
                transform: 'rotate(-14deg)',
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws a PNG, next/image has no place here */}
            <img src={assets.logo} alt="" width={118} height={118} />
            <div
              style={{
                display: 'flex',
                fontFamily: 'Bagel',
                fontSize: 54,
                color: YELLOW,
                lineHeight: 1,
                letterSpacing: -1,
                textShadow: `4px 4px 0 ${RED}`,
              }}
            >
              {APP_NAME}
            </div>
          </div>

          {/* Side panel: dials and speaker. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 80 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 32,
                background: CREAM,
                border: `6px solid ${INK}`,
              }}
            >
              <div style={{ display: 'flex', width: 8, height: 26, borderRadius: 4, background: INK, transform: 'rotate(35deg)' }} />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 32,
                background: CREAM,
                border: `6px solid ${INK}`,
              }}
            >
              <div style={{ display: 'flex', width: 8, height: 26, borderRadius: 4, background: INK, transform: 'rotate(-60deg)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 6 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ display: 'flex', width: 58, height: 6, borderRadius: 3, background: INK, opacity: 0.8 }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', marginTop: 34, fontSize: 36, fontWeight: 900, textShadow: `3px 3px 0 ${INK}`, textAlign: 'center' }}>
          {tagline}
        </div>
        {sub && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 18,
              background: CREAM,
              color: INK,
              border: `5px solid ${INK}`,
              borderRadius: 999,
              padding: '4px 22px',
              fontSize: 24,
              fontWeight: 900,
              boxShadow: `5px 5px 0 ${INK}`,
            }}
          >
            <span style={{ display: 'flex', width: 16, height: 16, borderRadius: 8, background: RED, border: `3px solid ${INK}` }} />
            {sub}
          </div>
        )}
      </div>
    ),
    { ...SHARE_CARD_SIZE, fonts: cardFonts(assets) },
  );
}
