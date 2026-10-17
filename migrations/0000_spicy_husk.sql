CREATE TABLE `Category` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Category_userId_name_key` ON `Category` (`userId`,`name`);--> statement-breakpoint
CREATE INDEX `Category_userId_idx` ON `Category` (`userId`);--> statement-breakpoint
CREATE TABLE `DiaryEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`date` text NOT NULL,
	`fixedAnswer` text NOT NULL,
	`rotatingAnswers` text NOT NULL,
	`createdTaskIds` text DEFAULT '[]' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DiaryEntry_userId_date_key` ON `DiaryEntry` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `DiaryQuestion` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`prompt` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Event` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`startsAt` text NOT NULL,
	`endsAt` text,
	`location` text,
	`description` text,
	`categoryId` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Event_userId_startsAt_idx` ON `Event` (`userId`,`startsAt`);--> statement-breakpoint
CREATE TABLE `ExportLog` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`format` text NOT NULL,
	`scope` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `HabitLog` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`habitId` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`minutes` integer,
	`note` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `HabitLog_userId_date_idx` ON `HabitLog` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `HabitLog_habitId_date_idx` ON `HabitLog` (`habitId`,`date`);--> statement-breakpoint
CREATE TABLE `HabitTemplate` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`categoryId` text NOT NULL,
	`cadence` text NOT NULL,
	`targetCount` integer DEFAULT 1 NOT NULL,
	`targetValue` integer,
	`isActive` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `HabitTemplate_userId_categoryId_idx` ON `HabitTemplate` (`userId`,`categoryId`);--> statement-breakpoint
CREATE TABLE `JourneyState` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`karma` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`sublevel` integer DEFAULT 1 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `JourneyState_userId_key` ON `JourneyState` (`userId`);--> statement-breakpoint
CREATE TABLE `MemorizationItem` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`contentText` text NOT NULL,
	`currentLine` integer DEFAULT 1 NOT NULL,
	`totalLines` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `MemorizationProgressLog` (
	`id` text PRIMARY KEY NOT NULL,
	`itemId` text NOT NULL,
	`date` text NOT NULL,
	`line` integer NOT NULL,
	`note` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `MemorizationProgressLog_itemId_date_idx` ON `MemorizationProgressLog` (`itemId`,`date`);--> statement-breakpoint
CREATE TABLE `PhilosophicalQuote` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`text` text NOT NULL,
	`author` text,
	`isActive` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ReflectionEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`templateId` text NOT NULL,
	`date` text NOT NULL,
	`cycleNumber` integer,
	`cycleDay` integer NOT NULL,
	`contentText` text NOT NULL,
	`reflectionTimeSeconds` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'DONE' NOT NULL,
	`originType` text DEFAULT 'MANUAL' NOT NULL,
	`originTaskId` text,
	`linkedEntryId` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ReflectionEntry_userId_templateId_date_key` ON `ReflectionEntry` (`userId`,`templateId`,`date`);--> statement-breakpoint
CREATE INDEX `ReflectionEntry_userId_date_idx` ON `ReflectionEntry` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `ReflectionPostponement` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`templateId` text NOT NULL,
	`originalDate` text NOT NULL,
	`postponedToDate` text NOT NULL,
	`reason` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ReflectionPostponement_userId_originalDate_idx` ON `ReflectionPostponement` (`userId`,`originalDate`);--> statement-breakpoint
CREATE INDEX `ReflectionPostponement_userId_postponedToDate_idx` ON `ReflectionPostponement` (`userId`,`postponedToDate`);--> statement-breakpoint
CREATE TABLE `ReflectionTemplate` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`topic` text NOT NULL,
	`subtopic` text,
	`description` text NOT NULL,
	`insights` text,
	`orientation` text,
	`categoryId` text NOT NULL,
	`cycleDays` text NOT NULL,
	`period` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`isTemporary` integer DEFAULT 0 NOT NULL,
	`startDate` text,
	`endDate` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ReflectionTemplate_userId_categoryId_idx` ON `ReflectionTemplate` (`userId`,`categoryId`);--> statement-breakpoint
CREATE TABLE `TaskOccurrence` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`seriesId` text,
	`title` text NOT NULL,
	`description` text,
	`dueDate` text NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`categoryId` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`completedAt` text,
	`originType` text DEFAULT 'MANUAL' NOT NULL,
	`originReflectionTemplateId` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `TaskOccurrence_userId_dueDate_idx` ON `TaskOccurrence` (`userId`,`dueDate`);--> statement-breakpoint
CREATE INDEX `TaskOccurrence_userId_status_idx` ON `TaskOccurrence` (`userId`,`status`);--> statement-breakpoint
CREATE TABLE `TaskSeries` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`recurrence` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`birthDate` text,
	`mortemTargetAge` integer DEFAULT 60 NOT NULL,
	`cycleAnchorDate` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `WaterLog` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`date` text NOT NULL,
	`amountMl` integer NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `WaterLog_userId_date_idx` ON `WaterLog` (`userId`,`date`);