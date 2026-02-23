import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/errors";
import type {
  CollectInventoryDropInput,
  UpdateInventoryLayoutInput,
  UseInventoryItemInput,
  UseInventoryItemResult,
  UserInventoryOutput,
} from "../../types/inventory";
import {
  createDefaultInventoryLayout,
  INVENTORY_DEFAULT_BITS,
  INVENTORY_DEFAULT_CRYSTALS,
  INVENTORY_LOCKED_SLOT_START,
  INVENTORY_TOTAL_SLOTS,
} from "./inventory.constants";
import type { InventoryRepository, UserInventoryEntity } from "./inventory.repository";

const toOutput = (entity: UserInventoryEntity): UserInventoryOutput => ({
  bits: entity.bits,
  crystals: entity.crystals,
  totalSlots: INVENTORY_TOTAL_SLOTS,
  lockedSlotStart: INVENTORY_LOCKED_SLOT_START,
  layout: entity.layout,
  items: entity.items.map((entry) => ({
    itemId: entry.itemId,
    quantity: entry.quantity,
    slot: entry.slot,
    item: {
      id: entry.item.id,
      name: entry.item.name,
      description: entry.item.description,
      type: entry.item.type,
      imageData: entry.item.imageData,
      stackSize: entry.item.stackSize,
      healPercentMaxHp: entry.item.healPercentMaxHp,
      bonusAttack: entry.item.bonusAttack,
      bonusDefense: entry.item.bonusDefense,
      bonusMaxHp: entry.item.bonusMaxHp,
    },
  })),
  updatedAt: entity.updatedAt,
});

export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  private async getOrCreateInventory(userId: string) {
    const existing = await this.inventoryRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const created = await this.inventoryRepository.create(
      userId,
      INVENTORY_DEFAULT_BITS,
      INVENTORY_DEFAULT_CRYSTALS,
      createDefaultInventoryLayout(),
    );
    return created;
  }

  async getByUserId(userId: string) {
    const inventory = await this.getOrCreateInventory(userId);
    return toOutput(inventory);
  }

  async updateLayout(userId: string, input: UpdateInventoryLayoutInput) {
    const existing = await this.inventoryRepository.findByUserId(userId);
    if (!existing) {
      throw new AppError(404, "INVENTORY_NOT_FOUND", "Inventory not found");
    }

    const knownItemIds = new Set(existing.items.map((entry) => entry.itemId));
    const unknownLayoutItem = input.layout.find((entry) => !knownItemIds.has(entry.itemId));
    if (unknownLayoutItem) {
      throw new AppError(400, "INVENTORY_ITEM_NOT_FOUND", "One or more items are not present in inventory");
    }

    const updated = await this.inventoryRepository.updateLayout(userId, input.layout);
    return toOutput(updated);
  }

  async collectDrop(userId: string, input: CollectInventoryDropInput) {
    const quantity = Math.max(1, Math.floor(input.quantity));
    const item = await this.inventoryRepository.findItemById(input.itemId);
    if (!item) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item not found");
    }

    await this.getOrCreateInventory(userId);
    const updated = await this.inventoryRepository.addItem(userId, input.itemId, quantity);
    return toOutput(updated);
  }

  async useItem(userId: string, input: UseInventoryItemInput): Promise<UseInventoryItemResult> {
    const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
    const inventory = await this.getOrCreateInventory(userId);
    const inventoryEntry = inventory.items.find((entry) => entry.itemId === input.itemId) ?? null;
    if (!inventoryEntry) {
      throw new AppError(404, "ITEM_NOT_IN_INVENTORY", "Item is not in inventory");
    }
    if (inventoryEntry.quantity < quantity) {
      throw new AppError(400, "INSUFFICIENT_ITEM_QUANTITY", "Insufficient item quantity");
    }
    if (inventoryEntry.item.type !== "CONSUMIVEL") {
      throw new AppError(400, "ITEM_NOT_CONSUMABLE", "Only consumable items can be used");
    }

    const bonusAttackAdded = inventoryEntry.item.bonusAttack * quantity;
    const bonusDefenseAdded = inventoryEntry.item.bonusDefense * quantity;
    const bonusMaxHpAdded = inventoryEntry.item.bonusMaxHp * quantity;
    const hasAnyEffect =
      inventoryEntry.item.healPercentMaxHp > 0 || bonusAttackAdded > 0 || bonusDefenseAdded > 0 || bonusMaxHpAdded > 0;
    if (!hasAnyEffect) {
      throw new AppError(400, "CONSUMABLE_WITHOUT_EFFECT", "Consumable has no effect configured");
    }

    const primaryAnima = await prisma.adoptedAnima.findFirst({
      where: {
        userId,
        isPrimary: true,
      },
      include: {
        baseAnima: {
          select: {
            maxHp: true,
          },
        },
      },
    });
    if (!primaryAnima) {
      throw new AppError(400, "PRIMARY_ANIMA_REQUIRED", "A primary adopted anima is required to use consumables");
    }

    const totalMaxHpAfter = primaryAnima.baseAnima.maxHp + primaryAnima.bonusMaxHp + bonusMaxHpAdded;
    const healedPerUse =
      inventoryEntry.item.healPercentMaxHp > 0 ? Math.round((inventoryEntry.item.healPercentMaxHp / 100) * totalMaxHpAfter) : 0;
    const healedHp = healedPerUse * quantity;
    const nextCurrentHp = Math.min(totalMaxHpAfter, primaryAnima.currentHp + healedHp);

    await prisma.adoptedAnima.update({
      where: { id: primaryAnima.id },
      data: {
        bonusAttack: {
          increment: bonusAttackAdded,
        },
        bonusDefense: {
          increment: bonusDefenseAdded,
        },
        bonusMaxHp: {
          increment: bonusMaxHpAdded,
        },
        currentHp: nextCurrentHp,
      },
    });

    const updatedInventory = await this.inventoryRepository.consumeItem(userId, input.itemId, quantity);
    return {
      inventory: toOutput(updatedInventory),
      appliedEffect: {
        adoptedAnimaId: primaryAnima.id,
        nickname: primaryAnima.nickname,
        healedHp,
        bonusAttackAdded,
        bonusDefenseAdded,
        bonusMaxHpAdded,
        currentHp: nextCurrentHp,
        totalMaxHp: totalMaxHpAfter,
      },
    };
  }
}
