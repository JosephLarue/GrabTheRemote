import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
const PUBLIC_DIR = join(process.cwd(), 'public');

let cache: Promise<{ bagel: Buffer; nunito: Buffer; logo: string }> | undefined;

/** The site's fonts (Bagel Fat One for titles, Nunito Black for everything else) and the logo, for next/og images. */
export function cardAssets() {
  cache ??= Promise.all([
    readFile(join(FONT_DIR, 'BagelFatOne-Regular.ttf')),
    readFile(join(FONT_DIR, 'Nunito-Black.ttf')),
    readFile(join(PUBLIC_DIR, 'logo.png')),
  ]).then(([bagel, nunito, logo]) => ({ bagel, nunito, logo: `data:image/png;base64,${logo.toString('base64')}` }));
  return cache;
}

/** `fonts` option for ImageResponse: `fontFamily: 'Bagel'` for titles, everything else falls back to Nunito. */
export function cardFonts({ bagel, nunito }: { bagel: Buffer; nunito: Buffer }) {
  return [
    { name: 'Nunito', data: nunito, weight: 900 as const, style: 'normal' as const },
    { name: 'Bagel', data: bagel, weight: 400 as const, style: 'normal' as const },
  ];
}
