DROP INDEX `ShoppingItem_userId_checked_idx`;--> statement-breakpoint
ALTER TABLE `ShoppingItem` ADD `dueDate` text;--> statement-breakpoint
CREATE INDEX `ShoppingItem_userId_checked_dueDate_idx` ON `ShoppingItem` (`userId`,`isChecked`,`dueDate`);