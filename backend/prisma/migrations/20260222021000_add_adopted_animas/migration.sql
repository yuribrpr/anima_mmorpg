-- CreateTable
CREATE TABLE `AdoptedAnima` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `baseAnimaId` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `experience` INTEGER NOT NULL DEFAULT 0,
    `experienceMax` INTEGER NOT NULL DEFAULT 1000,
    `currentHp` INTEGER NOT NULL,
    `bonusAttack` INTEGER NOT NULL DEFAULT 0,
    `bonusDefense` INTEGER NOT NULL DEFAULT 0,
    `bonusMaxHp` INTEGER NOT NULL DEFAULT 0,
    `attackSpeedReduction` DOUBLE NOT NULL DEFAULT 0,
    `critChanceBonus` DOUBLE NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdoptedAnima_userId_idx`(`userId`),
    INDEX `AdoptedAnima_baseAnimaId_idx`(`baseAnimaId`),
    INDEX `AdoptedAnima_userId_isPrimary_idx`(`userId`, `isPrimary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdoptedAnima` ADD CONSTRAINT `AdoptedAnima_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdoptedAnima` ADD CONSTRAINT `AdoptedAnima_baseAnimaId_fkey` FOREIGN KEY (`baseAnimaId`) REFERENCES `Anima`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
