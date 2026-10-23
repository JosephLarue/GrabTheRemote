import type { Metadata } from 'next';
import { APP_NAME, LEGAL, VOTE_COOLDOWN_S } from '@/config/app';

export const metadata: Metadata = { title: 'Privacy' };

// Plain-language summary. Have it reviewed before launch (GDPR: operator based in France).
export default function PrivacyPage() {
  return (
    <article className="panel mx-auto max-w-3xl p-6 sm:p-8 [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-xl [&_p]:mt-2 [&_li]:mt-1">
      <h1 className="font-display text-3xl">Privacy</h1>
      <p>
        {APP_NAME} has no accounts. Here is everything we process and why. Contact for any request: {LEGAL.contactEmail}.
      </p>

      <h2>Your IP address</h2>
      <p>
        To allow one vote every {VOTE_COOLDOWN_S / 60} minutes per connection, we turn your IP address into a scrambled code
        (a keyed hash) as soon as a request arrives. The raw IP is never stored. The code is kept in temporary memory and
        expires automatically: after {VOTE_COOLDOWN_S / 60} minutes for votes, and after one video for skip and report
        votes. IPv6 addresses are shortened to their network prefix before hashing.
      </p>

      <h2>Bot protection</h2>
      <p>
        Votes, skips and reports go through Cloudflare Turnstile, which checks that you are human. Cloudflare processes
        technical data about your browser for that check.
      </p>

      <h2>What we keep</h2>
      <p>
        Public data about the videos that were played (title, channel, duration), how many people watched, and how they
        ended. None of it is linked to you.
      </p>

      <h2>Your browser</h2>
      <p>
        We keep a short list of videos you voted for in your browser&apos;s local storage, only so we can show confetti when
        one of them plays. It never leaves your device.
      </p>

      <h2>YouTube</h2>
      <p>
        Videos play in the YouTube player using its privacy-enhanced mode (youtube-nocookie.com). Google&apos;s privacy
        policy applies to the player.
      </p>

      <h2>Ads</h2>
      <p>
        When ads are enabled, they are served by Google AdSense. Visitors in the EEA, the UK and Switzerland are asked for
        consent first; without it, only non-personalized ads are shown. You can change your choice at any time from the
        consent link shown by the ad provider.
      </p>

      <h2>Your rights</h2>
      <p>
        Since we can&apos;t link any stored data back to you, there is usually nothing to access or delete. You can still
        contact us, and you can complain to the CNIL (cnil.fr).
      </p>
    </article>
  );
}
