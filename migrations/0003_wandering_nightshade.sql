CREATE TABLE `ADProposal` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`date` text NOT NULL,
	`theme` text NOT NULL,
	`summary` text NOT NULL,
	`context` text NOT NULL,
	`openQuestion` text NOT NULL,
	`practice` text NOT NULL,
	`references` text NOT NULL,
	`sourceStatus` text NOT NULL,
	`createdAt` text NOT NULL,
	`dismissedAt` text
);
--> statement-breakpoint
CREATE INDEX `ADProposal_userId_idx` ON `ADProposal` (`userId`);--> statement-breakpoint
CREATE TABLE `ADReflection` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`proposalId` text NOT NULL,
	`date` text NOT NULL,
	`theme` text NOT NULL,
	`summary` text NOT NULL,
	`context` text NOT NULL,
	`openQuestion` text NOT NULL,
	`practice` text NOT NULL,
	`references` text NOT NULL,
	`sourceStatus` text NOT NULL,
	`origin` text DEFAULT 'AD / conversa' NOT NULL,
	`confirmedAt` text NOT NULL,
	`confirmation` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ADReflection_proposalId_key` ON `ADReflection` (`proposalId`);--> statement-breakpoint
CREATE INDEX `ADReflection_userId_date_idx` ON `ADReflection` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `ApprovedPassage` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`sourcePassageId` text,
	`workId` text NOT NULL,
	`author` text NOT NULL,
	`work` text NOT NULL,
	`edition` text NOT NULL,
	`location` text NOT NULL,
	`excerpt` text NOT NULL,
	`themes` text NOT NULL,
	`approvedAt` text NOT NULL,
	`confirmation` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ApprovedPassage_userId_idx` ON `ApprovedPassage` (`userId`);