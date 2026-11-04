import type { Metadata, Viewport } from 'next';
import { Bagel_Fat_One, Cinzel, Nunito, Rubik_Wet_Paint } from 'next/font/google';
import { APP_NAME, APP_TAGLINE, SITE_URL } from '@/config/app';
import { AdsScript } from '@/components/AdsScript';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { localeOf } from '@/i18n';
import { lastRoom } from '@/lib/last-room';
import './globals.css';

const bagel = Bagel_Fat_One({ variable: '--font-bagel', weight: '400', subsets: ['latin'] });
const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'] });
// The Jungle's factions have their own lettering: royal capitals for the Alliance, dripping paint for the Horde.
// Not preloaded: only those two looks use them.
const cinzel = Cinzel({ variable: '--font-cinzel', weight: '700', subsets: ['latin'], preload: false });
const wetPaint = Rubik_Wet_Paint({ variable: '--font-wet-paint', weight: '400', subsets: ['latin'], preload: false });

export const metadata: Metadata = {
  // Absolute base for og:image and friends. Read at build time, like every NEXT_PUBLIC_* variable.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: `${APP_TAGLINE} Everyone watches the same YouTube video. The crowd votes on what plays next.`,
  applicationName: APP_NAME,
  keywords: ['watch together', 'youtube together', 'watch party', 'shared screen', 'crowd votes', 'live', 'no account'],
  openGraph: { title: APP_NAME, description: APP_TAGLINE, type: 'website', siteName: APP_NAME },
  twitter: { card: 'summary_large_image', title: APP_NAME, description: APP_TAGLINE },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  category: 'entertainment',
  // Search Console and Bing Webmaster ownership tags, from the environment so the repo carries no token.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || null,
    other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

// Structured data: one web app, searchable by room.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: APP_NAME, url: SITE_URL, inLanguage: ['en', 'fr', 'es', 'it'] },
    {
      '@type': 'WebApplication',
      name: APP_NAME,
      url: SITE_URL,
      description: `${APP_TAGLINE} Everyone watches the same YouTube video. The crowd votes on what plays next.`,
      applicationCategory: 'EntertainmentApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
  ],
};

export const viewport: Viewport = { themeColor: '#6c4df6', viewportFit: 'cover' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const room = await lastRoom();
  return (
    // Browser extensions (LanguageTool, ColorZilla…) stamp attributes on <html> and <body> before React loads.
    // This only silences attribute mismatches on these two tags, not on anything inside them.
    <html lang={localeOf(room)} suppressHydrationWarning>
      <head>
        {/* The player, its thumbnails and the captcha come from elsewhere: shake hands early. */}
        <link rel="preconnect" href="https://www.youtube-nocookie.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      {/* Column with a growing main: the footer sits at the bottom of the window even when the page is short. */}
      <body className={`${bagel.variable} ${nunito.variable} ${cinzel.variable} ${wetPaint.variable} flex flex-col antialiased`} suppressHydrationWarning>
        <Header lastRoom={room} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">{children}</main>
        <Footer lastRoom={room} />
        <AdsScript />
      </body>
    </html>
  );
}
