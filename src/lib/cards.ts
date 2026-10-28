// Hall of Shame trading cards: a rarity per disaster, and the browser's collection of cards it earned
// (plays it voted for that the crowd cut short). Shared by the client and the card renderer.

export const RARITIES = ['mythic', 'legendary', 'epic', 'rare', 'common', 'banned'] as const;
export type Rarity = (typeof RARITIES)[number];

/** How it ended and how long it lasted → rarity. Faster deaths are rarer; a veto is one of a kind. */
export function rarityOf(reason: string | undefined, lastedS: number): Rarity {
  if (reason === 'reported') return 'banned';
  if (reason === 'vetoed') return 'mythic';
  if (lastedS < 5) return 'legendary';
  if (lastedS < 20) return 'epic';
  if (lastedS < 60) return 'rare';
  return 'common';
}

/** Foil colours per rarity: [from, via, to], used by the CSS holo gradient and the PNG renderer. */
export const FOIL: Record<Rarity, [string, string, string]> = {
  mythic: ['#ff4a3d', '#ffd23f', '#ff5da2'],
  legendary: ['#ffd23f', '#fff6e0', '#ff9b4a'],
  epic: ['#b388ff', '#3ddcff', '#ff5da2'],
  rare: ['#3ddcff', '#5ef2b5', '#6c4df6'],
  common: ['#d9cffd', '#fff6e0', '#a99ce0'],
  banned: ['#1c1236', '#ff4a3d', '#1c1236'],
};

export type CardRef = { room: string; playId: number; videoId: string; at: number };

const CARDS_KEY = 'gtr:cards';
const MAX_CARDS = 200;

export function myCards(): CardRef[] {
  try {
    const cards = JSON.parse(localStorage.getItem(CARDS_KEY) ?? '[]') as CardRef[];
    return Array.isArray(cards) ? cards : [];
  } catch {
    return [];
  }
}

export function hasCard(room: string, playId: number) {
  return myCards().some((c) => c.room === room && c.playId === playId);
}

/** Fired on window whenever the collection changes, so a collection on screen can refresh. */
export const CARDS_EVENT = 'gtr:cards';

/** Adds a card to the collection. Returns false if it was already there. */
export function addCard(ref: Omit<CardRef, 'at'>): boolean {
  if (hasCard(ref.room, ref.playId)) return false;
  try {
    localStorage.setItem(CARDS_KEY, JSON.stringify([{ ...ref, at: Date.now() }, ...myCards()].slice(0, MAX_CARDS)));
    window.dispatchEvent(new Event(CARDS_EVENT));
    return true;
  } catch {
    return false;
  }
}
