import { z } from "zod";
import { INVENTORY_LOCKED_SLOT_START, INVENTORY_TOTAL_SLOTS } from "./inventory.constants";

export const inventoryItemLayoutSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  slot: z.number().int().min(0).max(INVENTORY_TOTAL_SLOTS - 1),
});

export const updateInventoryLayoutSchema = z
  .object({
    layout: z.array(inventoryItemLayoutSchema).max(INVENTORY_LOCKED_SLOT_START),
  })
  .superRefine((input, context) => {
    const slotSet = new Set<number>();
    const itemIdSet = new Set<string>();

    input.layout.forEach((item, index) => {
      if (item.slot >= INVENTORY_LOCKED_SLOT_START) {
        context.addIssue({
          path: ["layout", index, "slot"],
          code: z.ZodIssueCode.custom,
          message: "Slot locked for this account",
        });
      }

      if (slotSet.has(item.slot)) {
        context.addIssue({
          path: ["layout", index, "slot"],
          code: z.ZodIssueCode.custom,
          message: "Slot already used",
        });
      }

      if (itemIdSet.has(item.itemId)) {
        context.addIssue({
          path: ["layout", index, "itemId"],
          code: z.ZodIssueCode.custom,
          message: "Duplicated item",
        });
      }

      slotSet.add(item.slot);
      itemIdSet.add(item.itemId);
    });
  });

export const collectInventoryDropSchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(9999).default(1),
});

export const useInventoryItemSchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(9999).optional().default(1),
});
