-- CreateTable
CREATE TABLE `Item` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` ENUM('CONSUMIVEL', 'QUEST', 'NORMAL') NOT NULL,
    `imageData` LONGTEXT NULL,
    `stackSize` INTEGER NOT NULL DEFAULT 99,
    `healPercentMaxHp` DOUBLE NOT NULL DEFAULT 0,
    `bonusAttack` INTEGER NOT NULL DEFAULT 0,
    `bonusDefense` INTEGER NOT NULL DEFAULT 0,
    `bonusMaxHp` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Item_name_idx`(`name`),
    INDEX `Item_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BestiaryDrop` (
    `id` VARCHAR(191) NOT NULL,
    `bestiaryAnimaId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `dropChance` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BestiaryDrop_bestiaryAnimaId_idx`(`bestiaryAnimaId`),
    INDEX `BestiaryDrop_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserInventoryItem` (
    `id` VARCHAR(191) NOT NULL,
    `inventoryId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `slot` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserInventoryItem_inventoryId_slot_idx`(`inventoryId`, `slot`),
    UNIQUE INDEX `UserInventoryItem_inventoryId_itemId_key`(`inventoryId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BestiaryDrop` ADD CONSTRAINT `BestiaryDrop_bestiaryAnimaId_fkey` FOREIGN KEY (`bestiaryAnimaId`) REFERENCES `BestiaryAnima`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BestiaryDrop` ADD CONSTRAINT `BestiaryDrop_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInventoryItem` ADD CONSTRAINT `UserInventoryItem_inventoryId_fkey` FOREIGN KEY (`inventoryId`) REFERENCES `UserInventory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInventoryItem` ADD CONSTRAINT `UserInventoryItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
