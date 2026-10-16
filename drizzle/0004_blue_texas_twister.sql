CREATE TABLE `IndexedPassage` (
	`id` text PRIMARY KEY NOT NULL,
	`workId` text NOT NULL,
	`revision` text NOT NULL,
	`unitId` text NOT NULL,
	`sequence` integer NOT NULL,
	`startOffset` integer NOT NULL,
	`endOffset` integer NOT NULL,
	`page` integer,
	`section` text,
	`location` text NOT NULL,
	`text` text NOT NULL,
	`textHash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IndexedPassage_workId_revision_idx` ON `IndexedPassage` (`workId`,`revision`);--> statement-breakpoint
CREATE TABLE `IndexedUnit` (
	`id` text PRIMARY KEY NOT NULL,
	`workId` text NOT NULL,
	`revision` text NOT NULL,
	`number` integer NOT NULL,
	`page` integer,
	`section` text,
	`location` text NOT NULL,
	`text` text NOT NULL,
	`textHash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IndexedUnit_workId_revision_idx` ON `IndexedUnit` (`workId`,`revision`);--> statement-breakpoint
CREATE TABLE `IndexedWork` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`edition` text NOT NULL,
	`editionNote` text NOT NULL,
	`sourceFile` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`sourceType` text NOT NULL,
	`sourceHash` text NOT NULL,
	`revision` text NOT NULL,
	`status` text NOT NULL,
	`unitCount` integer NOT NULL,
	`passageCount` integer NOT NULL,
	`characterCount` integer NOT NULL,
	`indexedAt` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `IndexedPassageSearch` (`passageId` text PRIMARY KEY NOT NULL, `normalizedText` text NOT NULL);
