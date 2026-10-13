ALTER TABLE `tasks` ADD `contentKind` text NOT NULL DEFAULT 'article';
--> statement-breakpoint
ALTER TABLE `tasks` ADD `title` text;
--> statement-breakpoint
ALTER TABLE `drafts` ADD `contentKind` text NOT NULL DEFAULT 'article';
--> statement-breakpoint
ALTER TABLE `drafts` ADD `title` text;
--> statement-breakpoint
UPDATE `tasks` SET `contentKind` = 'video' WHERE `images` LIKE '%.mp4%' OR `images` LIKE '%.mov%' OR `images` LIKE '%.m4v%' OR `images` LIKE '%.webm%';
--> statement-breakpoint
UPDATE `tasks` SET `contentKind` = 'moment' WHERE `contentKind` = 'article' AND `images` NOT IN ('[]', '');
--> statement-breakpoint
UPDATE `drafts` SET `contentKind` = 'video' WHERE `images` LIKE '%.mp4%' OR `images` LIKE '%.mov%' OR `images` LIKE '%.m4v%' OR `images` LIKE '%.webm%';
--> statement-breakpoint
UPDATE `drafts` SET `contentKind` = 'moment' WHERE `contentKind` = 'article' AND `images` NOT IN ('[]', '');
--> statement-breakpoint
PRAGMA user_version = 5;
