import { APP_NAME, APP_TAGLINE } from '@/config/app';
import { SHARE_CARD_SIZE, shareCard } from '@/lib/share-card';

export const alt = APP_NAME;
export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const revalidate = 60;

// Default share card: the pink TV on grape wallpaper.
export default function OgImage() {
  return shareCard({ wall: '#6c4df6', tv: '#ff5da2', tagline: APP_TAGLINE });
}
