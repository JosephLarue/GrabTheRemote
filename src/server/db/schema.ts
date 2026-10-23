import { boolean, index, integer, pgEnum, pgTable, serial, text, timestamp, bigint } from 'drizzle-orm/pg-core';

export const videos = pgTable('videos', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  channelId: text('channel_id').notNull(),
  channelTitle: text('channel_title').notNull(),
  durationS: integer('duration_s').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  viewCount: bigint('view_count', { mode: 'number' }).notNull(),
  categoryId: text('category_id').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  embeddable: boolean('embeddable').notNull(),
  ageRestricted: boolean('age_restricted').notNull(),
  flagged: boolean('flagged').notNull().default(false),
  banned: boolean('banned').notNull().default(false),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  statsFetchedAt: timestamp('stats_fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bannedChannels = pgTable('banned_channels', {
  channelId: text('channel_id').primaryKey(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const blockedKeywords = pgTable('blocked_keywords', {
  keyword: text('keyword').primaryKey(),
});

export const playSource = pgEnum('play_source', ['pool', 'fallback']);
export const endReason = pgEnum('end_reason', ['finished', 'skipped', 'reported', 'admin']);

export const plays = pgTable(
  'plays',
  {
    id: serial('id').primaryKey(),
    videoId: text('video_id').notNull().references(() => videos.id),
    votesAtPick: integer('votes_at_pick').notNull().default(0),
    source: playSource('source').notNull(),
    themeId: text('theme_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReason: endReason('end_reason'),
    viewerSeconds: integer('viewer_seconds').notNull().default(0),
    peakViewers: integer('peak_viewers').notNull().default(0),
    skipVotes: integer('skip_votes').notNull().default(0),
    reportVotes: integer('report_votes').notNull().default(0),
  },
  (t) => [index('plays_video_idx').on(t.videoId), index('plays_started_idx').on(t.startedAt)],
);

export const themeSlots = pgTable('theme_slots', {
  slotId: integer('slot_id').primaryKey(),
  constraintId: text('constraint_id'),
});

export type VideoRow = typeof videos.$inferSelect;
export type PlayRow = typeof plays.$inferSelect;
