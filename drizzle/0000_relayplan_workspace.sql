CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_updated_at` ON `workspaces` (`updated_at`);
