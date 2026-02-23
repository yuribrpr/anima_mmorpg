-- AlterTable
ALTER TABLE `UserInventory`
  ADD COLUMN `hotbar` JSON NULL;

-- Seed default hotbar for existing rows
UPDATE `UserInventory`
SET `hotbar` = JSON_ARRAY(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
WHERE `hotbar` IS NULL;

-- Enforce non-null after backfill
ALTER TABLE `UserInventory`
  MODIFY COLUMN `hotbar` JSON NOT NULL;
