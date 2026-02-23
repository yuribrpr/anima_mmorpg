import { Item, Prisma, UserInventory } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type { InventoryItemLayout } from "../../types/inventory";
import { INVENTORY_LOCKED_SLOT_START } from "./inventory.constants";
const HOTBAR_SLOT_COUNT = 9;

type ItemSummary = Pick<
  Item,
  "id" | "name" | "description" | "type" | "imageData" | "stackSize" | "healPercentMaxHp" | "bonusAttack" | "bonusDefense" | "bonusMaxHp"
>;

export type UserInventoryItemEntity = {
  id: string;
  inventoryId: string;
  itemId: string;
  quantity: number;
  slot: number | null;
  createdAt: Date;
  updatedAt: Date;
  item: ItemSummary;
};

export type UserInventoryEntity = Omit<UserInventory, "layout"> & {
  layout: InventoryItemLayout[];
  hotbar: Array<string | null>;
  items: UserInventoryItemEntity[];
};

const itemSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  imageData: true,
  stackSize: true,
  healPercentMaxHp: true,
  bonusAttack: true,
  bonusDefense: true,
  bonusMaxHp: true,
} as const;

const inventoryWithItemsArgs = Prisma.validator<Prisma.UserInventoryDefaultArgs>()({
  include: {
    items: {
      include: {
        item: {
          select: itemSelect,
        },
      },
      orderBy: [{ slot: "asc" }, { createdAt: "asc" }],
    },
  },
});

type UserInventoryWithItems = Prisma.UserInventoryGetPayload<typeof inventoryWithItemsArgs>;

const normalizeLayout = (value: Prisma.JsonValue): InventoryItemLayout[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: InventoryItemLayout[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const data = entry as Record<string, unknown>;
    if (typeof data.itemId !== "string" || typeof data.slot !== "number") {
      continue;
    }

    output.push({
      itemId: data.itemId,
      slot: Math.floor(data.slot),
    });
  }

  return output;
};

const normalizeHotbar = (value: Prisma.JsonValue): Array<string | null> => {
  if (!Array.isArray(value)) {
    return Array.from({ length: HOTBAR_SLOT_COUNT }, () => null as string | null);
  }
  const result = Array.from({ length: HOTBAR_SLOT_COUNT }, (_, index) => {
    const entry = value[index];
    return typeof entry === "string" ? entry : null;
  });
  return result;
};

const sanitizeHotbarByItems = (hotbar: Array<string | null>, items: { itemId: string }[]) => {
  const known = new Set(items.map((entry) => entry.itemId));
  return hotbar.map((itemId) => (itemId && known.has(itemId) ? itemId : null));
};

const toLayoutFromItems = (items: { itemId: string; slot: number | null }[]): InventoryItemLayout[] =>
  items
    .filter((entry) => entry.slot !== null && entry.slot >= 0 && entry.slot < INVENTORY_LOCKED_SLOT_START)
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map((entry) => ({
      itemId: entry.itemId,
      slot: Number(entry.slot),
    }));

const toEntity = (inventory: UserInventoryWithItems): UserInventoryEntity => ({
  ...inventory,
  layout: inventory.items.length > 0 ? toLayoutFromItems(inventory.items) : normalizeLayout(inventory.layout),
  hotbar: sanitizeHotbarByItems(normalizeHotbar(inventory.hotbar), inventory.items),
  items: inventory.items.map((entry) => ({
    id: entry.id,
    inventoryId: entry.inventoryId,
    itemId: entry.itemId,
    quantity: entry.quantity,
    slot: entry.slot,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    item: entry.item,
  })),
});

const findFirstFreeSlot = (items: { slot: number | null }[]) => {
  const used = new Set<number>();
  for (const item of items) {
    if (item.slot !== null && item.slot >= 0 && item.slot < INVENTORY_LOCKED_SLOT_START) {
      used.add(item.slot);
    }
  }

  for (let slot = 0; slot < INVENTORY_LOCKED_SLOT_START; slot += 1) {
    if (!used.has(slot)) {
      return slot;
    }
  }

  return null;
};

export interface InventoryRepository {
  findByUserId(userId: string): Promise<UserInventoryEntity | null>;
  create(userId: string, bits: number, crystals: number, layout: InventoryItemLayout[]): Promise<UserInventoryEntity>;
  updateLayout(userId: string, layout: InventoryItemLayout[]): Promise<UserInventoryEntity>;
  updateHotbar(userId: string, hotbar: Array<string | null>): Promise<UserInventoryEntity>;
  findItemById(itemId: string): Promise<ItemSummary | null>;
  addItem(userId: string, itemId: string, quantity: number): Promise<UserInventoryEntity>;
  consumeItem(userId: string, itemId: string, quantity: number): Promise<UserInventoryEntity>;
}

export class PrismaInventoryRepository implements InventoryRepository {
  async findByUserId(userId: string) {
    const inventory = await prisma.userInventory.findUnique({
      where: { userId },
      ...inventoryWithItemsArgs,
    });
    return inventory ? toEntity(inventory) : null;
  }

  async create(userId: string, bits: number, crystals: number, layout: InventoryItemLayout[]) {
    const inventory = await prisma.userInventory.create({
      data: {
        userId,
        bits,
        crystals,
        layout,
        hotbar: Array.from({ length: HOTBAR_SLOT_COUNT }, () => null),
      },
      ...inventoryWithItemsArgs,
    });

    return toEntity(inventory);
  }

  async updateLayout(userId: string, layout: InventoryItemLayout[]) {
    const inventory = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!existing) {
        return null;
      }

      await transaction.userInventoryItem.updateMany({
        where: { inventoryId: existing.id },
        data: { slot: null },
      });

      for (const entry of layout) {
        await transaction.userInventoryItem.updateMany({
          where: {
            inventoryId: existing.id,
            itemId: entry.itemId,
          },
          data: {
            slot: entry.slot,
          },
        });
      }

      const refreshed = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!refreshed) {
        return null;
      }

      const nextLayout = toLayoutFromItems(refreshed.items);
      const nextHotbar = sanitizeHotbarByItems(normalizeHotbar(refreshed.hotbar), refreshed.items);
      const persisted = await transaction.userInventory.update({
        where: { userId },
        data: {
          layout: nextLayout,
          hotbar: nextHotbar,
        },
        ...inventoryWithItemsArgs,
      });
      return persisted;
    });

    if (!inventory) {
      throw new Error("INVENTORY_NOT_FOUND");
    }
    return toEntity(inventory);
  }

  async updateHotbar(userId: string, hotbar: Array<string | null>) {
    const inventory = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!existing) {
        return null;
      }

      const sanitized = sanitizeHotbarByItems(
        hotbar.slice(0, HOTBAR_SLOT_COUNT).concat(Array.from({ length: HOTBAR_SLOT_COUNT }, () => null)).slice(0, HOTBAR_SLOT_COUNT),
        existing.items,
      );
      const persisted = await transaction.userInventory.update({
        where: { userId },
        data: {
          hotbar: sanitized,
        },
        ...inventoryWithItemsArgs,
      });
      return persisted;
    });

    if (!inventory) {
      throw new Error("INVENTORY_NOT_FOUND");
    }
    return toEntity(inventory);
  }

  async findItemById(itemId: string) {
    return prisma.item.findUnique({
      where: { id: itemId },
      select: itemSelect,
    });
  }

  async addItem(userId: string, itemId: string, quantity: number) {
    const inventory = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!existing) {
        return null;
      }

      const existingEntry = existing.items.find((entry) => entry.itemId === itemId) ?? null;
      if (existingEntry) {
        await transaction.userInventoryItem.update({
          where: { id: existingEntry.id },
          data: {
            quantity: existingEntry.quantity + quantity,
          },
        });
      } else {
        const slot = findFirstFreeSlot(existing.items);
        await transaction.userInventoryItem.create({
          data: {
            inventoryId: existing.id,
            itemId,
            quantity,
            slot,
          },
        });
      }

      const refreshed = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!refreshed) {
        return null;
      }

      const nextLayout = toLayoutFromItems(refreshed.items);
      const nextHotbar = sanitizeHotbarByItems(normalizeHotbar(refreshed.hotbar), refreshed.items);
      const persisted = await transaction.userInventory.update({
        where: { userId },
        data: {
          layout: nextLayout,
          hotbar: nextHotbar,
        },
        ...inventoryWithItemsArgs,
      });
      return persisted;
    });

    if (!inventory) {
      throw new Error("INVENTORY_NOT_FOUND");
    }
    return toEntity(inventory);
  }

  async consumeItem(userId: string, itemId: string, quantity: number) {
    const inventory = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!existing) {
        return null;
      }

      const entry = existing.items.find((item) => item.itemId === itemId) ?? null;
      if (!entry) {
        throw new Error("ITEM_NOT_IN_INVENTORY");
      }
      if (entry.quantity < quantity) {
        throw new Error("INSUFFICIENT_ITEM_QUANTITY");
      }

      const remaining = entry.quantity - quantity;
      if (remaining > 0) {
        await transaction.userInventoryItem.update({
          where: { id: entry.id },
          data: {
            quantity: remaining,
          },
        });
      } else {
        await transaction.userInventoryItem.delete({
          where: { id: entry.id },
        });
      }

      const refreshed = await transaction.userInventory.findUnique({
        where: { userId },
        ...inventoryWithItemsArgs,
      });
      if (!refreshed) {
        return null;
      }

      const nextLayout = toLayoutFromItems(refreshed.items);
      const nextHotbar = sanitizeHotbarByItems(normalizeHotbar(refreshed.hotbar), refreshed.items);
      const persisted = await transaction.userInventory.update({
        where: { userId },
        data: {
          layout: nextLayout,
          hotbar: nextHotbar,
        },
        ...inventoryWithItemsArgs,
      });
      return persisted;
    });

    if (!inventory) {
      throw new Error("INVENTORY_NOT_FOUND");
    }
    return toEntity(inventory);
  }
}
