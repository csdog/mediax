ALTER TABLE `accounts` ADD COLUMN `platform` text NOT NULL DEFAULT 'facebook';
--> statement-breakpoint
PRAGMA user_version = 4;
