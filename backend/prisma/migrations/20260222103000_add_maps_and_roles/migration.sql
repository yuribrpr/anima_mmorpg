-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `role` ENUM('PLAYER', 'ADMIN') NOT NULL DEFAULT 'PLAYER';

-- Bootstrap existing users as ADMIN
UPDATE `User` SET `role` = 'ADMIN';

-- CreateTable
CREATE TABLE `GameMap` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `worldWidth` INTEGER NOT NULL DEFAULT 1920,
    `worldHeight` INTEGER NOT NULL DEFAULT 1088,
    `cellSize` INTEGER NOT NULL DEFAULT 32,
    `cols` INTEGER NOT NULL DEFAULT 60,
    `rows` INTEGER NOT NULL DEFAULT 34,
    `backgroundImageData` LONGTEXT NULL,
    `backgroundScale` DOUBLE NOT NULL DEFAULT 1,
    `tilePalette` JSON NOT NULL,
    `tileLayer` JSON NOT NULL,
    `collisionLayer` JSON NOT NULL,
    `spawnX` INTEGER NOT NULL DEFAULT 0,
    `spawnY` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GameMap_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerMapState` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mapId` VARCHAR(191) NOT NULL,
    `tileX` INTEGER NOT NULL,
    `tileY` INTEGER NOT NULL,
    `scaleX` DOUBLE NOT NULL DEFAULT 3,
    `scaleY` DOUBLE NOT NULL DEFAULT 3,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerMapState_userId_mapId_key`(`userId`, `mapId`),
    INDEX `PlayerMapState_mapId_idx`(`mapId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayerMapState` ADD CONSTRAINT `PlayerMapState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerMapState` ADD CONSTRAINT `PlayerMapState_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `GameMap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
