import type { Metadata, Viewport } from 'next';
import { Bagel_Fat_One, Nunito } from 'next/font/google';
import { APP_NAME, APP_TAGLINE } from '@/config/app';
import { AdsScript } from '@/components/AdsScript';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import './globals.css';

const bagel = Bagel_Fat_One({ variable: '--font-bagel', weight: '400', subsets: ['latin'] });
const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'] });

export const metadata: Metadata = {
  // Absolute base for og:image and friends. Read at build time, like every NEXT_PUBLIC_* variable.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: `${APP_TAGLINE} Everyone watches the same YouTube video. The crowd votes on what plays next.`,
  openGraph: { title: APP_NAME, description: APP_TAGLINE, type: 'website' },
};

export const viewport: Viewport = { themeColor: '#6c4df6' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bagel.variable} ${nunito.variable} antialiased`}>
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16">{children}</main>
        <Footer />
        <AdsScript />
      </body>
    </html>
  );
}
