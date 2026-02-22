-- CreateTable
CREATE TABLE `BestiaryAnima` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `attack` INTEGER NOT NULL,
    `attackSpeedSeconds` DOUBLE NOT NULL,
    `critChance` DOUBLE NOT NULL,
    `agility` INTEGER NOT NULL,
    `defense` INTEGER NOT NULL,
    `maxHp` INTEGER NOT NULL,
    `imageData` LONGTEXT NULL,
    `powerLevel` ENUM('ROOKIE', 'CHAMPION', 'ULTIMATE', 'MEGA', 'BURST_MODE') NOT NULL,
    `bitsDrop` INTEGER NOT NULL,
    `xpDrop` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BestiaryAnima_name_idx`(`name`),
    INDEX `BestiaryAnima_powerLevel_idx`(`powerLevel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
