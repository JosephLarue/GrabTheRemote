import type { Metadata } from 'next';
import { localeOf } from '@/i18n';
import { lastRoom } from '@/lib/last-room';
import { PRIVACY } from './copy';

const copy = async () => PRIVACY[localeOf(await lastRoom())] ?? PRIVACY.en;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await copy()).title };
}

// Outside any room: speaks and looks like the last room visited.
export default async function PrivacyPage() {
  const room = await lastRoom();
  const { title, body } = await copy();
  return (
    <div data-room={room} className="contents">
      <article className="panel mx-auto max-w-3xl p-6 sm:p-8 [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-xl [&_p]:mt-2 [&_li]:mt-1">
        <h1 className="font-display text-3xl">{title}</h1>
        {body}
      </article>
    </div>
  );
}
