ALTER TABLE `events` ADD `custom_fields` text;--> statement-breakpoint
ALTER TABLE `inscriptions` ADD `display_name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `inscriptions` ADD `email` text;--> statement-breakpoint
ALTER TABLE `inscriptions` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `inscriptions` ADD `custom_data` text;--> statement-breakpoint
ALTER TABLE `inscriptions` DROP COLUMN `participant_name`;--> statement-breakpoint
ALTER TABLE `inscriptions` DROP COLUMN `participant_email`;--> statement-breakpoint
ALTER TABLE `inscriptions` DROP COLUMN `participant_phone`;