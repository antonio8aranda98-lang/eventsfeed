CREATE TABLE `access` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`role` text NOT NULL,
	`team` integer NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`player` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL,
	`author` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`location` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`team` integer NOT NULL,
	`player` text,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`announced` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`team` integer DEFAULT 0 NOT NULL,
	`attendance` text DEFAULT 'pending' NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`goals` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`event` text NOT NULL,
	`team` integer NOT NULL,
	`expires` integer NOT NULL
);
