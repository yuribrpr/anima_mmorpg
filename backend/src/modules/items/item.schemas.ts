import { z } from "zod";
import { ITEM_TYPES } from "../../types/item";

const itemTypeSchema = z.enum(ITEM_TYPES);

export const itemParamsSchema = z.object({
  id: z.string().min(1),
});

export const createItemSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(1000),
    type: itemTypeSchema,
    imageData: z.string().trim().min(1).max(55_000_000).nullable().optional(),
    stackSize: z.number().int().min(1).max(9999).optional().default(99),
    healPercentMaxHp: z.number().min(0).max(100).optional().default(0),
    bonusAttack: z.number().int().min(0).max(9999).optional().default(0),
    bonusDefense: z.number().int().min(0).max(9999).optional().default(0),
    bonusMaxHp: z.number().int().min(0).max(999999).optional().default(0),
  })
  .superRefine((input, context) => {
    if (input.type !== "CONSUMIVEL") {
      return;
    }

    const hasEffect =
      (input.healPercentMaxHp ?? 0) > 0 ||
      (input.bonusAttack ?? 0) > 0 ||
      (input.bonusDefense ?? 0) > 0 ||
      (input.bonusMaxHp ?? 0) > 0;

    if (!hasEffect) {
      context.addIssue({
        path: ["type"],
        code: z.ZodIssueCode.custom,
        message: "Consumivel precisa ter ao menos um efeito",
      });
    }
  });

export const updateItemSchema = createItemSchema;
