/** Ads run only with AdSense fully configured: provider set to `adsense` and a client id to load it with. */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_PROVIDER === 'adsense' && ADSENSE_CLIENT !== '';

/** Pages that stay ad-free: the legal pages, the admin and private rooms (a streamer's own couch). */
const AD_FREE = /^\/(privacy|legal|admin|p-[a-z0-9]{6})(\/|$)/;

/** Whether ads belong on this path: configured, and not an ad-free page. */
export const adsOn = (path: string | null) => ADS_ENABLED && !(path && AD_FREE.test(path));
