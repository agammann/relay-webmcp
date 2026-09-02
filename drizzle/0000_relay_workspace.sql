CREATE TABLE IF NOT EXISTS `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspaces_updated_at` ON `workspaces` (`updated_at`);
