-- AlterTable
ALTER TABLE `Anima`
  ADD COLUMN `nextEvolutionLevelRequired` INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE `AdoptedAnima`
  ADD COLUMN `isNextEvolutionUnlocked` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `GlobalSettings` (
    `id` VARCHAR(191) NOT NULL,
    `singletonKey` VARCHAR(191) NOT NULL DEFAULT 'global',
    `expMultiplier` DOUBLE NOT NULL DEFAULT 1,
    `bitsMultiplier` DOUBLE NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GlobalSettings_singletonKey_key`(`singletonKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default singleton row
INSERT INTO `GlobalSettings` (`id`, `singletonKey`, `expMultiplier`, `bitsMultiplier`, `createdAt`, `updatedAt`)
VALUES ('global_settings_default', 'global', 1, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
