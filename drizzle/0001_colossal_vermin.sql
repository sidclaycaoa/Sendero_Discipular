CREATE TABLE `ShoppingItem` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`isChecked` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ShoppingItem_userId_checked_idx` ON `ShoppingItem` (`userId`,`isChecked`,`createdAt`);