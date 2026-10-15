ALTER TABLE `tasks` ADD `scheduledAt` text;
--> statement-breakpoint
PRAGMA user_version = 6;
