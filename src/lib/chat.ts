import { CHAT_MAX_LENGTH } from '@/config/app';

// Couch chat, shared by the routes and the page. Nobody has an account: each browser tab makes up a random
// seed, and the seed picks a nickname from the lists below. The server derives the name itself, so nobody
// can type their own (or anyone else's on purpose: the lists only make couch furniture).

const ADJECTIVES = [
  'Sleepy', 'Sticky', 'Crunchy', 'Grumpy', 'Turbo', 'Fuzzy', 'Sneaky', 'Salty', 'Cozy', 'Wobbly',
  'Snacky', 'Dramatic', 'Lazy', 'Spicy', 'Retro', 'Glitchy', 'Bingeing', 'Loud', 'Muted', 'Buffering',
  'Overcaffeinated', 'Chaotic', 'Suspicious', 'Unbothered', 'Feral', 'Pixelated', 'Rewinding', 'Zapping',
  'Napping', 'Cheesy', 'Crispy', 'Fluffy', 'Haunted', 'Squishy', 'Tiny', 'Mighty', 'Smug', 'Caffeinated',
  'Dusty', 'Legendary',
];

const NOUNS = [
  'Couch Potato', 'Channel Surfer', 'Remote', 'Antenna', 'Popcorn', 'Cushion', 'Rabbit Ears', 'Test Pattern',
  'Laugh Track', 'Sitcom', 'Commercial Break', 'Nacho', 'Recliner', 'Blanket', 'Rerun', 'Cliffhanger',
  'Plot Twist', 'Spoiler', 'Binge Watcher', 'Volume Knob', 'VHS Tape', 'Pixel', 'Sofa', 'Armrest',
  'Pizza Slice', 'Soda Can', 'Couch Goblin', 'Couch Gremlin', 'Infomercial', 'Season Finale', 'Pilot Episode',
  'Credits Scene', 'Mute Button', 'Pause Button', 'TV Dinner', 'Snack Drawer', 'Static', 'Rewind Button',
  'Lost Sock', 'Couch Crumb',
];

export type ChatName = { name: string; /** 0-359, the colour of the name badge. */ hue: number };

/** What the browser makes up once per tab session. */
export const isChatSeed = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{8,64}$/.test(v);

// FNV-1a, then a murmur finalizer so every bit counts: tiny, no secret needed. The name only has to look random.
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function chatName(seed: string): ChatName {
  const h = hash(seed);
  const noun = Math.floor(h / ADJECTIVES.length);
  return {
    name: `${ADJECTIVES[h % ADJECTIVES.length]} ${NOUNS[noun % NOUNS.length]}`,
    hue: Math.floor(noun / NOUNS.length) % 360,
  };
}

/**
 * The message as everyone will see it, or '' if nothing is left. Control and invisible characters go (they
 * hide spam and flip text), so do piles of combining marks (zalgo); whitespace collapses to single spaces.
 */
export function cleanChatText(raw: string) {
  return raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁩﻿]/g, ' ')
    .replace(/(\p{M})\p{M}+/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
}

/** Links are how chat spam gets in, so there are none on the couch. */
export const hasLink = (text: string) =>
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|tv|ly|me|co|xyz|ru|fr|es|it|link|click|live|shop)\b/i.test(text);
