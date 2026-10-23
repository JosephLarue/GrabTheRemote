import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, LEGAL } from '@/config/app';

export const metadata: Metadata = { title: 'Legal notice' };

// Mentions légales (LCEN, art. 6). Every value lives in LEGAL (src/config/app.ts).
export default function LegalPage() {
  return (
    <article className="panel mx-auto max-w-3xl p-6 sm:p-8 [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-xl [&_p]:mt-2">
      <h1 className="font-display text-3xl">Legal notice</h1>
      <p className="text-[var(--muted)]">Mentions légales</p>

      <h2>Publisher</h2>
      <p>
        {APP_NAME} is published by {LEGAL.publisher}, {LEGAL.publisherAddress}.
        <br />
        Publication director: {LEGAL.publicationDirector}.
        <br />
        Contact: {LEGAL.contactEmail}
      </p>

      <h2>Hosting</h2>
      <p>
        {LEGAL.host}, {LEGAL.hostAddress}, {LEGAL.hostWebsite}.
      </p>

      <h2>Content</h2>
      <p>
        Videos are chosen by visitors and played through the YouTube player. They belong to their authors and are
        governed by YouTube&apos;s terms. {APP_NAME} is not affiliated with YouTube or Google. To report content, use
        the Report button on screen or write to the contact above.
      </p>

      <h2>Personal data</h2>
      <p>
        See the{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy page
        </Link>
        .
      </p>
    </article>
  );
}
