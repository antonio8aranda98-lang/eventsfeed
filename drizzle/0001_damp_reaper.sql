ALTER TABLE `events` ADD `team_count` integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `roster_revision` integer DEFAULT 0 NOT NULL;