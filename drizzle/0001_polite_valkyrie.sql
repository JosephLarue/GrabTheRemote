ALTER TABLE "plays" ADD COLUMN "room" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX "plays_room_idx" ON "plays" USING btree ("room");