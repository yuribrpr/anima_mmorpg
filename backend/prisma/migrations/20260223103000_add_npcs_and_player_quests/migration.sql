-- AlterTable
ALTER TABLE `GameMap` ADD COLUMN `npcPlacements` JSON NULL;

-- CreateTable
CREATE TABLE `NpcDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `imageData` LONGTEXT NULL,
    `dialogs` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NpcDefinition_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerQuest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questKey` VARCHAR(191) NOT NULL,
    `sourceNpcId` VARCHAR(191) NOT NULL,
    `sourceNpcName` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `progress` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerQuest_userId_questKey_key`(`userId`, `questKey`),
    INDEX `PlayerQuest_userId_status_idx`(`userId`, `status`),
    INDEX `PlayerQuest_sourceNpcId_idx`(`sourceNpcId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayerQuest` ADD CONSTRAINT `PlayerQuest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerQuest` ADD CONSTRAINT `PlayerQuest_sourceNpcId_fkey` FOREIGN KEY (`sourceNpcId`) REFERENCES `NpcDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
