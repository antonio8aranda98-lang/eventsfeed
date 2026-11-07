ALTER TABLE `events` ADD `team_settings` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `team_settings_version` integer DEFAULT 0 NOT NULL;