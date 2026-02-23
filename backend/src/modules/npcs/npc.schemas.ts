import { z } from "zod";

const questKillObjectiveSchema = z.object({
  id: z.string().trim().min(1).max(120),
  bestiaryAnimaId: z.string().trim().min(1).max(191),
  bestiaryName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  quantity: z.number().int().min(1).max(9_999),
});

const questDropObjectiveSchema = z.object({
  id: z.string().trim().min(1).max(120),
  itemId: z.string().trim().min(1).max(191),
  itemName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  quantity: z.number().int().min(1).max(9_999),
});

const questRewardItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  itemId: z.string().trim().min(1).max(191),
  itemName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  quantity: z.number().int().min(1).max(9_999),
});

const questTemplateSchema = z.object({
  questType: z.enum(["MAIN", "SUB", "DAILY", "REPEATABLE"]).optional().default("SUB"),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(560),
  talkToNpcId: z.string().trim().min(1).max(191).nullable().optional().default(null),
  talkToNpcName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  rewardBits: z.number().int().min(0).max(99_999_999).optional().default(0),
  rewardXp: z.number().int().min(0).max(99_999_999).optional().default(0),
  rewardItems: z.array(questRewardItemSchema).max(20).default([]),
  killObjectives: z.array(questKillObjectiveSchema).max(12).default([]),
  dropObjectives: z.array(questDropObjectiveSchema).max(12).default([]),
});

const npcShopBuyOfferSchema = z.object({
  id: z.string().trim().min(1).max(120),
  itemId: z.string().trim().min(1).max(191),
  itemName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  description: z.string().trim().max(300).optional().default(""),
  quantity: z.number().int().min(1).max(9_999),
  bitsCost: z.number().int().min(0).max(99_999_999),
});

const npcCraftRequirementSchema = z.object({
  itemId: z.string().trim().min(1).max(191),
  itemName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  quantity: z.number().int().min(1).max(9_999),
});

const npcShopCraftRecipeSchema = z.object({
  id: z.string().trim().min(1).max(120),
  resultItemId: z.string().trim().min(1).max(191),
  resultItemName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  description: z.string().trim().max(300).optional().default(""),
  resultQuantity: z.number().int().min(1).max(9_999),
  requirements: z.array(npcCraftRequirementSchema).min(1).max(12),
});

const npcDialogSchema = z.object({
  id: z.string().trim().min(1).max(120),
  text: z.string().trim().max(900).optional().default(""),
  actionType: z.enum(["NONE", "QUEST", "SHOP_BUY", "SHOP_CRAFT"]),
  quest: questTemplateSchema.nullable().optional().default(null),
  buyOffers: z.array(npcShopBuyOfferSchema).max(80).default([]),
  craftRecipes: z.array(npcShopCraftRecipeSchema).max(80).default([]),
}).superRefine((dialog, context) => {
  if (dialog.actionType === "QUEST") {
    if (!dialog.text || dialog.text.trim().length < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quest dialog must contain text",
        path: ["text"],
      });
    }
  }
});

export const createNpcDefinitionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  imageData: z.string().min(20).max(55_000_000).nullable(),
  dialogs: z.array(npcDialogSchema).max(80),
});

export const updateNpcDefinitionSchema = createNpcDefinitionSchema;

export const npcParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const acceptNpcQuestSchema = z.object({
  npcId: z.string().trim().min(1),
  dialogId: z.string().trim().min(1),
});

export const deliverNpcQuestSchema = z.object({
  npcId: z.string().trim().min(1),
  questId: z.string().trim().min(1),
});

export const registerNpcTalkSchema = z.object({
  npcId: z.string().trim().min(1),
});

export const npcBuySchema = z.object({
  npcId: z.string().trim().min(1),
  dialogId: z.string().trim().min(1),
  offerId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(9_999).optional().default(1),
});

export const npcCraftSchema = z.object({
  npcId: z.string().trim().min(1),
  dialogId: z.string().trim().min(1),
  recipeId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(9_999).optional().default(1),
});

export const registerEnemyDefeatSchema = z.object({
  bestiaryAnimaId: z.string().trim().min(1),
  droppedItems: z
    .array(
      z.object({
        itemId: z.string().trim().min(1),
        quantity: z.number().int().min(1).max(9_999),
      }),
    )
    .max(100)
    .default([]),
});
