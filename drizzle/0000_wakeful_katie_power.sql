CREATE TYPE "public"."end_reason" AS ENUM('finished', 'skipped', 'reported', 'admin');--> statement-breakpoint
CREATE TYPE "public"."play_source" AS ENUM('pool', 'fallback');--> statement-breakpoint
CREATE TABLE "banned_channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_keywords" (
	"keyword" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"votes_at_pick" integer DEFAULT 0 NOT NULL,
	"source" "play_source" NOT NULL,
	"theme_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" "end_reason",
	"viewer_seconds" integer DEFAULT 0 NOT NULL,
	"peak_viewers" integer DEFAULT 0 NOT NULL,
	"skip_votes" integer DEFAULT 0 NOT NULL,
	"report_votes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_slots" (
	"slot_id" integer PRIMARY KEY NOT NULL,
	"constraint_id" text
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_title" text NOT NULL,
	"duration_s" integer NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"view_count" bigint NOT NULL,
	"category_id" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"embeddable" boolean NOT NULL,
	"age_restricted" boolean NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stats_fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plays_video_idx" ON "plays" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "plays_started_idx" ON "plays" USING btree ("started_at");