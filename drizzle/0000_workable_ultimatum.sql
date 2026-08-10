CREATE TABLE `app_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`country` text NOT NULL,
	`version` text,
	`price` real,
	`rating` real,
	`rating_count` integer,
	`raw_json` text,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_app_snapshots_app_country_time` ON `app_snapshots` (`app_id`,`country`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`apple_id` text NOT NULL,
	`name` text NOT NULL,
	`developer` text,
	`icon_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_apps_apple_id` ON `apps` (`apple_id`);--> statement-breakpoint
CREATE TABLE `insights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`conclusion` text NOT NULL,
	`recommendation` text,
	`evidence_json` text NOT NULL,
	`confidence` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`app_id` integer,
	`keyword_id` integer,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `keyword_ranking_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword_id` integer NOT NULL,
	`app_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_keyword_rankings_keyword_time` ON `keyword_ranking_snapshots` (`keyword_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`country` text NOT NULL,
	`language` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_keywords_keyword_country` ON `keywords` (`keyword`,`country`);--> statement-breakpoint
CREATE TABLE `ranking_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`country` text NOT NULL,
	`category` text NOT NULL,
	`collection` text NOT NULL,
	`rank` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rankings_market_time` ON `ranking_snapshots` (`country`,`category`,`collection`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_id` text NOT NULL,
	`app_id` integer NOT NULL,
	`country` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`author` text,
	`app_version` text,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reviews_provider_country` ON `reviews` (`provider_id`,`country`);--> statement-breakpoint
CREATE INDEX `idx_reviews_app_country_time` ON `reviews` (`app_id`,`country`,`published_at`);