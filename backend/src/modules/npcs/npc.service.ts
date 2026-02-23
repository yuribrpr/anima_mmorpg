import { PlayerQuestStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/errors";
import {
  AcceptNpcQuestInput,
  CreateNpcDefinitionInput,
  DeliverNpcQuestInput,
  DeliverNpcQuestOutput,
  NpcBuyInput,
  NpcCraftInput,
  NpcDefinitionOutput,
  NpcDialog,
  NpcDialogActionType,
  NpcShopBuyOffer,
  NpcShopCraftRecipe,
  PlayerQuestObjectiveProgress,
  PlayerQuestOutput,
  QuestRewardItem,
  QuestType,
  RegisterEnemyDefeatInput,
  RegisterEnemyDefeatOutput,
  RegisterNpcTalkInput,
  UpdateNpcDefinitionInput,
} from "../../types/npc";
import { INVENTORY_DEFAULT_BITS, INVENTORY_DEFAULT_CRYSTALS, INVENTORY_LOCKED_SLOT_START } from "../inventory/inventory.constants";

type QuestStorageData = {
  dialogId: string;
  questType: QuestType;
  rewardBits: number;
  rewardXp: number;
  rewardItems: QuestRewardItem[];
};

type QuestStorageProgress = {
  objectives: PlayerQuestObjectiveProgress[];
};

type InventoryWithItems = Prisma.UserInventoryGetPayload<{
  include: {
    items: true;
  };
}>;

type PlacementNpc = {
  id: string;
  npcId: string;
  npcName: string | null;
  imageData: string | null;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  npc: NpcDefinitionOutput | null;
};

const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));
const clampMultiplier = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1_000_000, value));
};

const normalizeString = (value: unknown, fallback = "") => (typeof value === "string" ? value.trim() : fallback);

const normalizeNpcDialogActionType = (value: unknown): NpcDialogActionType => {
  if (value === "QUEST" || value === "SHOP_BUY" || value === "SHOP_CRAFT") {
    return value;
  }
  return "NONE";
};

const normalizeQuestType = (value: unknown): QuestType => {
  if (value === "MAIN" || value === "SUB" || value === "DAILY" || value === "REPEATABLE") {
    return value;
  }
  return "SUB";
};

const normalizeKillObjectives = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: normalizeString(row.id) || `${normalizeString(row.bestiaryAnimaId)}_${Math.random().toString(16).slice(2, 6)}`,
        bestiaryAnimaId: normalizeString(row.bestiaryAnimaId),
        bestiaryName: normalizeString(row.bestiaryName) || null,
        quantity: clampInt(Number(row.quantity ?? 1), 1, 9999),
      };
    })
    .filter((item) => item.bestiaryAnimaId.length > 0);
};

const normalizeDropObjectives = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: normalizeString(row.id) || `${normalizeString(row.itemId)}_${Math.random().toString(16).slice(2, 6)}`,
        itemId: normalizeString(row.itemId),
        itemName: normalizeString(row.itemName) || null,
        quantity: clampInt(Number(row.quantity ?? 1), 1, 9999),
      };
    })
    .filter((item) => item.itemId.length > 0);
};

const normalizeRewardItems = (value: unknown): QuestRewardItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: normalizeString(row.id) || `reward_${Math.random().toString(16).slice(2, 8)}`,
        itemId: normalizeString(row.itemId),
        itemName: normalizeString(row.itemName) || null,
        quantity: clampInt(Number(row.quantity ?? 1), 1, 9999),
      };
    })
    .filter((item) => item.itemId.length > 0);
};

const normalizeBuyOffers = (value: unknown): NpcShopBuyOffer[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: normalizeString(row.id) || `offer_${Math.random().toString(16).slice(2, 8)}`,
        itemId: normalizeString(row.itemId),
        itemName: normalizeString(row.itemName) || null,
        description: normalizeString(row.description),
        quantity: clampInt(Number(row.quantity ?? 1), 1, 9999),
        bitsCost: clampInt(Number(row.bitsCost ?? 0), 0, 99_999_999),
      };
    })
    .filter((item) => item.itemId.length > 0);
};

const normalizeCraftRecipes = (value: unknown): NpcShopCraftRecipe[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      const requirementsRaw = Array.isArray(row.requirements) ? row.requirements : [];
      const requirements = requirementsRaw
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => {
          const req = entry as Record<string, unknown>;
          return {
            itemId: normalizeString(req.itemId),
            itemName: normalizeString(req.itemName) || null,
            quantity: clampInt(Number(req.quantity ?? 1), 1, 9999),
          };
        })
        .filter((entry) => entry.itemId.length > 0);

      return {
        id: normalizeString(row.id) || `recipe_${Math.random().toString(16).slice(2, 8)}`,
        resultItemId: normalizeString(row.resultItemId),
        resultItemName: normalizeString(row.resultItemName) || null,
        description: normalizeString(row.description),
        resultQuantity: clampInt(Number(row.resultQuantity ?? 1), 1, 9999),
        requirements,
      };
    })
    .filter((item) => item.resultItemId.length > 0 && item.requirements.length > 0);
};

const normalizeDialogs = (value: Prisma.JsonValue): NpcDialog[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const questRaw = row.quest && typeof row.quest === "object" ? (row.quest as Record<string, unknown>) : null;
      return {
        id: normalizeString(row.id) || `dialog_${Math.random().toString(16).slice(2, 8)}`,
        text: normalizeString(row.text),
        actionType: normalizeNpcDialogActionType(row.actionType),
        quest: questRaw
          ? {
              questType: normalizeQuestType(questRaw.questType),
              title: normalizeString(questRaw.title),
              description: normalizeString(questRaw.description),
              talkToNpcId: normalizeString(questRaw.talkToNpcId) || null,
              talkToNpcName: normalizeString(questRaw.talkToNpcName) || null,
              rewardBits: clampInt(Number(questRaw.rewardBits ?? 0), 0, 99_999_999),
              rewardXp: clampInt(Number(questRaw.rewardXp ?? 0), 0, 99_999_999),
              rewardItems: normalizeRewardItems(questRaw.rewardItems),
              killObjectives: normalizeKillObjectives(questRaw.killObjectives),
              dropObjectives: normalizeDropObjectives(questRaw.dropObjectives),
            }
          : null,
        buyOffers: normalizeBuyOffers(row.buyOffers),
        craftRecipes: normalizeCraftRecipes(row.craftRecipes),
      };
    })
    .filter((dialog) => dialog.id.length > 0 && (dialog.actionType !== "QUEST" || dialog.text.length > 0));
};

const toNpcOutput = (entity: { id: string; name: string; imageData: string | null; dialogs: Prisma.JsonValue; createdAt: Date; updatedAt: Date }): NpcDefinitionOutput => ({
  id: entity.id,
  name: entity.name,
  imageData: entity.imageData,
  dialogs: normalizeDialogs(entity.dialogs),
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

const normalizeQuestProgress = (value: Prisma.JsonValue): PlayerQuestObjectiveProgress[] => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const root = value as { objectives?: unknown };
  const objectives = Array.isArray(root.objectives) ? root.objectives : [];
  const output: PlayerQuestObjectiveProgress[] = [];

  for (const raw of objectives) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const row = raw as Record<string, unknown>;
    const id = normalizeString(row.id);
    const type = normalizeString(row.type);
    const required = clampInt(Number(row.required ?? 1), 1, 9999);
    const current = clampInt(Number(row.current ?? 0), 0, required);
    const completed = current >= required || row.completed === true;

    if (!id || (type !== "TALK" && type !== "KILL" && type !== "DROP")) {
      continue;
    }

    if (type === "TALK") {
      const npcId = normalizeString(row.npcId);
      if (!npcId) continue;
      output.push({
        id,
        type,
        npcId,
        npcName: normalizeString(row.npcName) || null,
        required,
        current,
        completed,
      });
      continue;
    }

    if (type === "KILL") {
      const bestiaryAnimaId = normalizeString(row.bestiaryAnimaId);
      if (!bestiaryAnimaId) continue;
      output.push({
        id,
        type,
        bestiaryAnimaId,
        bestiaryName: normalizeString(row.bestiaryName) || null,
        required,
        current,
        completed,
      });
      continue;
    }

    const itemId = normalizeString(row.itemId);
    if (!itemId) continue;
    output.push({
      id,
      type,
      itemId,
      itemName: normalizeString(row.itemName) || null,
      required,
      current,
      completed,
    });
  }

  return output;
};

const toQuestOutput = (entity: {
  id: string;
  questKey: string;
  sourceNpcId: string;
  sourceNpcName: string;
  data: Prisma.JsonValue;
  title: string;
  description: string;
  progress: Prisma.JsonValue;
  status: PlayerQuestStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PlayerQuestOutput => {
  const data =
    (entity.data as { questType?: unknown; rewardBits?: unknown; rewardXp?: unknown; rewardItems?: unknown } | null | undefined) ?? null;
  const objectives = normalizeQuestProgress(entity.progress);
  const fallbackReward = computeQuestReward(objectives);
  const rewardBits = clampInt(Number(data?.rewardBits ?? fallbackReward.bits), 0, 99_999_999);
  const rewardXp = clampInt(Number(data?.rewardXp ?? fallbackReward.xp), 0, 99_999_999);
  const rewardItems = normalizeRewardItems(data?.rewardItems);

  return {
    questType: normalizeQuestType(data?.questType),
    turnInReady: entity.status === "ACTIVE" && isQuestComplete(objectives),
    rewardBits,
    rewardXp,
    rewardItems,
    id: entity.id,
    questKey: entity.questKey,
    sourceNpcId: entity.sourceNpcId,
    sourceNpcName: entity.sourceNpcName,
    title: entity.title,
    description: entity.description,
    status: entity.status,
    completedAt: entity.completedAt,
    objectives,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

const buildLayoutFromInventoryItems = (items: { itemId: string; slot: number | null }[]) =>
  items
    .filter((item) => item.slot !== null && item.slot >= 0 && item.slot < INVENTORY_LOCKED_SLOT_START)
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map((item) => ({
      itemId: item.itemId,
      slot: Number(item.slot),
    }));

const findFirstFreeInventorySlot = (items: { slot: number | null }[]) => {
  const usedSlots = new Set<number>();
  for (const item of items) {
    if (item.slot !== null && item.slot >= 0 && item.slot < INVENTORY_LOCKED_SLOT_START) {
      usedSlots.add(item.slot);
    }
  }

  for (let slot = 0; slot < INVENTORY_LOCKED_SLOT_START; slot += 1) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }
  return null;
};

const buildQuestObjectives = (dialog: NpcDialog): PlayerQuestObjectiveProgress[] => {
  const objectives: PlayerQuestObjectiveProgress[] = [];
  if (!dialog.quest) {
    return objectives;
  }

  if (dialog.quest.talkToNpcId) {
    objectives.push({
      id: `talk_${dialog.quest.talkToNpcId}`,
      type: "TALK",
      npcId: dialog.quest.talkToNpcId,
      npcName: dialog.quest.talkToNpcName ?? null,
      required: 1,
      current: 0,
      completed: false,
    });
  }

  for (const objective of dialog.quest.killObjectives) {
    objectives.push({
      id: objective.id,
      type: "KILL",
      bestiaryAnimaId: objective.bestiaryAnimaId,
      bestiaryName: objective.bestiaryName ?? null,
      required: clampInt(objective.quantity, 1, 9999),
      current: 0,
      completed: false,
    });
  }

  for (const objective of dialog.quest.dropObjectives) {
    objectives.push({
      id: objective.id,
      type: "DROP",
      itemId: objective.itemId,
      itemName: objective.itemName ?? null,
      required: clampInt(objective.quantity, 1, 9999),
      current: 0,
      completed: false,
    });
  }

  return objectives;
};

const isQuestComplete = (objectives: PlayerQuestObjectiveProgress[]) => objectives.length > 0 && objectives.every((objective) => objective.completed);

const computeQuestReward = (objectives: PlayerQuestObjectiveProgress[]) => {
  let bits = 0;
  let xp = 0;

  for (const objective of objectives) {
    if (objective.type === "TALK") {
      bits += objective.required * 60;
      xp += objective.required * 45;
      continue;
    }
    if (objective.type === "KILL") {
      bits += objective.required * 36;
      xp += objective.required * 26;
      continue;
    }
    bits += objective.required * 30;
    xp += objective.required * 22;
  }

  return {
    bits: clampInt(bits, 0, 99_999_999),
    xp: clampInt(xp, 0, 99_999_999),
  };
};

export class NpcService {
  async listAdmin() {
    const npcs = await prisma.npcDefinition.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return npcs.map(toNpcOutput);
  }

  async create(input: CreateNpcDefinitionInput) {
    const entity = await prisma.npcDefinition.create({
      data: {
        name: input.name.trim(),
        imageData: input.imageData ?? null,
        dialogs: input.dialogs,
      },
    });

    return toNpcOutput(entity);
  }

  async update(id: string, input: UpdateNpcDefinitionInput) {
    const existing = await prisma.npcDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError(404, "NPC_NOT_FOUND", "Npc not found");
    }

    const entity = await prisma.npcDefinition.update({
      where: { id },
      data: {
        name: input.name.trim(),
        imageData: input.imageData ?? null,
        dialogs: input.dialogs,
      },
    });

    return toNpcOutput(entity);
  }

  async delete(id: string) {
    const existing = await prisma.npcDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError(404, "NPC_NOT_FOUND", "Npc not found");
    }

    await prisma.npcDefinition.delete({
      where: { id },
    });
  }

  private async resolveNpcDialog(input: { npcId: string; dialogId: string; allowedAction?: NpcDialogActionType[] }) {
    const npc = await prisma.npcDefinition.findUnique({
      where: { id: input.npcId },
    });
    if (!npc) {
      throw new AppError(404, "NPC_NOT_FOUND", "Npc not found");
    }

    const parsedNpc = toNpcOutput(npc);
    const dialog = parsedNpc.dialogs.find((entry) => entry.id === input.dialogId) ?? null;
    if (!dialog) {
      throw new AppError(404, "NPC_DIALOG_NOT_FOUND", "Dialog not found");
    }

    if (input.allowedAction && !input.allowedAction.includes(dialog.actionType)) {
      throw new AppError(400, "NPC_DIALOG_ACTION_INVALID", "Dialog action is not valid for this operation");
    }

    return { npc: parsedNpc, dialog };
  }

  private async getOrCreateInventoryTx(transaction: Prisma.TransactionClient, userId: string): Promise<InventoryWithItems> {
    const existing = await transaction.userInventory.findUnique({
      where: { userId },
      include: {
        items: true,
      },
    });
    if (existing) {
      return existing;
    }

    return transaction.userInventory.create({
      data: {
        userId,
        bits: INVENTORY_DEFAULT_BITS,
        crystals: INVENTORY_DEFAULT_CRYSTALS,
        layout: [],
        hotbar: Array.from({ length: 9 }, () => null),
      },
      include: {
        items: true,
      },
    });
  }

  private async getRewardMultipliersTx(transaction: Prisma.TransactionClient) {
    const settings = await transaction.globalSettings.findUnique({
      where: { singletonKey: "global" },
      select: {
        expMultiplier: true,
        bitsMultiplier: true,
      },
    });

    return {
      expMultiplier: clampMultiplier(settings?.expMultiplier),
      bitsMultiplier: clampMultiplier(settings?.bitsMultiplier),
    };
  }

  private async addItemToInventoryTx(
    transaction: Prisma.TransactionClient,
    inventory: InventoryWithItems,
    itemId: string,
    quantity: number,
  ) {
    const existingItem = inventory.items.find((entry) => entry.itemId === itemId) ?? null;
    if (existingItem) {
      await transaction.userInventoryItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
        },
      });
      existingItem.quantity += quantity;
      return;
    }

    const freeSlot = findFirstFreeInventorySlot(inventory.items);
    const created = await transaction.userInventoryItem.create({
      data: {
        inventoryId: inventory.id,
        itemId,
        quantity,
        slot: freeSlot,
      },
    });
    inventory.items.push(created);
  }

  private async syncInventoryLayoutTx(transaction: Prisma.TransactionClient, userId: string) {
    const refreshed = await transaction.userInventory.findUnique({
      where: { userId },
      include: {
        items: true,
      },
    });
    if (!refreshed) {
      throw new AppError(404, "INVENTORY_NOT_FOUND", "Inventory not found");
    }

    const nextLayout = buildLayoutFromInventoryItems(refreshed.items);
    const updated = await transaction.userInventory.update({
      where: { userId },
      data: {
        layout: nextLayout,
      },
      include: {
        items: true,
      },
    });
    return updated;
  }

  private async addBitsTx(transaction: Prisma.TransactionClient, userId: string, bits: number) {
    const inventory = await this.getOrCreateInventoryTx(transaction, userId);
    const updated = await transaction.userInventory.update({
      where: { id: inventory.id },
      data: {
        bits: inventory.bits + bits,
      },
      include: {
        items: true,
      },
    });
    return updated.bits;
  }

  private async addExperienceToPrimaryTx(transaction: Prisma.TransactionClient, userId: string, xpGained: number) {
    const primary = await transaction.adoptedAnima.findFirst({
      where: {
        userId,
        isPrimary: true,
      },
      select: {
        id: true,
        level: true,
        experience: true,
        experienceMax: true,
      },
    });

    let level = 1;
    let experience = 0;
    let experienceMax = 1000;
    if (!primary) {
      return { level, experience, experienceMax };
    }

    level = Math.max(1, primary.level);
    experience = Math.max(0, primary.experience) + Math.max(0, Math.floor(xpGained));
    experienceMax = Math.max(1, primary.experienceMax);

    while (experience >= experienceMax) {
      experience -= experienceMax;
      level += 1;
      experienceMax = Math.max(experienceMax + 100, Math.round(experienceMax * 1.18));
    }

    await transaction.adoptedAnima.update({
      where: { id: primary.id },
      data: {
        level,
        experience,
        experienceMax,
      },
    });

    return { level, experience, experienceMax };
  }

  private async listActiveQuestsTx(transaction: Prisma.TransactionClient, userId: string) {
    const quests = await transaction.playerQuest.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return quests.map(toQuestOutput);
  }

  private async applyQuestProgressUpdateTx(
    transaction: Prisma.TransactionClient,
    userId: string,
    updateObjective: (objective: PlayerQuestObjectiveProgress) => PlayerQuestObjectiveProgress,
  ) {
    const activeQuests = await transaction.playerQuest.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    for (const quest of activeQuests) {
      const objectives = normalizeQuestProgress(quest.progress);
      if (objectives.length === 0) {
        continue;
      }

      let changed = false;
      const nextObjectives = objectives.map((objective) => {
        const nextObjective = updateObjective(objective);
        if (nextObjective.current !== objective.current || nextObjective.completed !== objective.completed) {
          changed = true;
        }
        return nextObjective;
      });

      if (!changed) {
        continue;
      }

      await transaction.playerQuest.update({
        where: { id: quest.id },
        data: {
          progress: {
            objectives: nextObjectives,
          } satisfies QuestStorageProgress,
        },
      });
    }

    return this.listActiveQuestsTx(transaction, userId);
  }

  private async resolveCurrentMapWithNpcPlacements(userId: string): Promise<PlacementNpc[]> {
    const latestState = await prisma.playerMapState.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { mapId: true },
    });

    const map = latestState
      ? await prisma.gameMap.findUnique({
          where: { id: latestState.mapId },
          select: { npcPlacements: true },
        })
      : await prisma.gameMap.findFirst({
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          select: { npcPlacements: true },
        });

    if (!map || !Array.isArray(map.npcPlacements)) {
      return [];
    }

    const placements = map.npcPlacements
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        return {
          id: normalizeString(row.id) || `npcp_${Math.random().toString(16).slice(2, 8)}`,
          npcId: normalizeString(row.npcId),
          npcName: normalizeString(row.npcName) || null,
          imageData: normalizeString(row.imageData) || null,
          tileX: clampInt(Number(row.tileX ?? 0), 0, 59),
          tileY: clampInt(Number(row.tileY ?? 0), 0, 33),
          width: clampInt(Number(row.width ?? 96), 8, 2000),
          height: clampInt(Number(row.height ?? 96), 8, 2000),
        };
      })
      .filter((entry) => entry.npcId.length > 0);

    if (placements.length === 0) {
      return [];
    }

    const npcIds = [...new Set(placements.map((entry) => entry.npcId))];
    const npcs = await prisma.npcDefinition.findMany({
      where: {
        id: {
          in: npcIds,
        },
      },
    });
    const npcMap = new Map(npcs.map((npc) => [npc.id, toNpcOutput(npc)]));

    return placements.map((placement) => ({
      ...placement,
      npc: npcMap.get(placement.npcId) ?? null,
    }));
  }

  async listActiveMapNpcs(userId: string) {
    return this.resolveCurrentMapWithNpcPlacements(userId);
  }

  async listPlayerQuests(userId: string) {
    const [active, completed] = await Promise.all([
      prisma.playerQuest.findMany({
        where: {
          userId,
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.playerQuest.findMany({
        where: {
          userId,
          status: "COMPLETED",
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 80,
      }),
    ]);

    return {
      activeQuests: active.map(toQuestOutput),
      completedQuests: completed.map(toQuestOutput),
    };
  }

  async acceptQuest(userId: string, input: AcceptNpcQuestInput) {
    const { npc, dialog } = await this.resolveNpcDialog({
      npcId: input.npcId,
      dialogId: input.dialogId,
      allowedAction: ["QUEST"],
    });

    if (!dialog.quest) {
      throw new AppError(400, "NPC_QUEST_INVALID", "Dialog has no quest configured");
    }

    const objectives = buildQuestObjectives(dialog);
    if (objectives.length === 0) {
      throw new AppError(400, "NPC_QUEST_EMPTY", "Quest must contain at least one objective");
    }
    const computedReward = computeQuestReward(objectives);
    const questRewardBits =
      dialog.quest.rewardBits > 0 || dialog.quest.rewardXp > 0 || dialog.quest.rewardItems.length > 0
        ? clampInt(dialog.quest.rewardBits, 0, 99_999_999)
        : computedReward.bits;
    const questRewardXp =
      dialog.quest.rewardBits > 0 || dialog.quest.rewardXp > 0 || dialog.quest.rewardItems.length > 0
        ? clampInt(dialog.quest.rewardXp, 0, 99_999_999)
        : computedReward.xp;
    const questRewardItems = dialog.quest.rewardItems.map((item) => ({
      id: item.id,
      itemId: item.itemId,
      itemName: item.itemName ?? null,
      quantity: clampInt(item.quantity, 1, 9999),
    }));

    const questKey = `${npc.id}:${dialog.id}`;
    const existing = await prisma.playerQuest.findUnique({
      where: {
        userId_questKey: {
          userId,
          questKey,
        },
      },
    });
    const isRepeatableQuest = normalizeQuestType(dialog.quest.questType) === "REPEATABLE";

    if (existing?.status === "ACTIVE") {
      return {
        accepted: false,
        reason: "already_active",
        quest: toQuestOutput(existing),
      };
    }
    if (existing?.status === "COMPLETED" && !isRepeatableQuest) {
      return {
        accepted: false,
        reason: "already_completed",
        quest: toQuestOutput(existing),
      };
    }

    const activeCount = await prisma.playerQuest.count({
      where: {
        userId,
        status: "ACTIVE",
      },
    });
    if (activeCount >= 3) {
      throw new AppError(400, "QUEST_ACTIVE_LIMIT_REACHED", "Quest active limit reached");
    }

    const quest =
      existing?.status === "COMPLETED" && isRepeatableQuest
        ? await prisma.playerQuest.update({
            where: {
              id: existing.id,
            },
            data: {
              sourceNpcId: npc.id,
              sourceNpcName: npc.name,
              title: dialog.quest.title,
              description: dialog.quest.description,
              data: {
                dialogId: dialog.id,
                questType: dialog.quest.questType,
                rewardBits: questRewardBits,
                rewardXp: questRewardXp,
                rewardItems: questRewardItems,
              } satisfies QuestStorageData,
              progress: {
                objectives,
              } satisfies QuestStorageProgress,
              status: "ACTIVE",
              completedAt: null,
            },
          })
        : await prisma.playerQuest.create({
            data: {
              userId,
              questKey,
              sourceNpcId: npc.id,
              sourceNpcName: npc.name,
              title: dialog.quest.title,
              description: dialog.quest.description,
              data: {
                dialogId: dialog.id,
                questType: dialog.quest.questType,
                rewardBits: questRewardBits,
                rewardXp: questRewardXp,
                rewardItems: questRewardItems,
              } satisfies QuestStorageData,
              progress: {
                objectives,
              } satisfies QuestStorageProgress,
              status: "ACTIVE",
            },
          });

    const activeQuests = await prisma.playerQuest.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      accepted: true,
      reason: null,
      quest: toQuestOutput(quest),
      activeQuests: activeQuests.map(toQuestOutput),
    };
  }

  async deliverQuest(userId: string, input: DeliverNpcQuestInput): Promise<DeliverNpcQuestOutput> {
    const quest = await prisma.playerQuest.findFirst({
      where: {
        id: input.questId,
        userId,
      },
    });
    if (!quest) {
      throw new AppError(404, "QUEST_NOT_FOUND", "Quest not found");
    }
    if (quest.sourceNpcId !== input.npcId) {
      throw new AppError(400, "QUEST_TURNIN_WRONG_NPC", "Quest must be delivered to the source NPC");
    }
    if (quest.status !== "ACTIVE") {
      throw new AppError(400, "QUEST_ALREADY_DELIVERED", "Quest is already delivered");
    }

    const objectives = normalizeQuestProgress(quest.progress);
    if (!isQuestComplete(objectives)) {
      throw new AppError(400, "QUEST_NOT_READY_TO_TURN_IN", "Quest objectives are not complete yet");
    }

    const questData = (quest.data as { rewardBits?: unknown; rewardXp?: unknown; rewardItems?: unknown } | null | undefined) ?? null;
    const fallbackReward = computeQuestReward(objectives);
    const baseRewardBits = clampInt(Number(questData?.rewardBits ?? fallbackReward.bits), 0, 99_999_999);
    const baseRewardXp = clampInt(Number(questData?.rewardXp ?? fallbackReward.xp), 0, 99_999_999);
    const rewardItems = normalizeRewardItems(questData?.rewardItems);

    return prisma.$transaction(async (transaction) => {
      const multipliers = await this.getRewardMultipliersTx(transaction);
      const rewardBits = clampInt(baseRewardBits * multipliers.bitsMultiplier, 0, 99_999_999);
      const rewardXp = clampInt(baseRewardXp * multipliers.expMultiplier, 0, 99_999_999);
      const completedQuest = await transaction.playerQuest.update({
        where: {
          id: quest.id,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      const inventory = await this.getOrCreateInventoryTx(transaction, userId);
      const inventoryBits = rewardBits > 0 ? await this.addBitsTx(transaction, userId, rewardBits) : inventory.bits;

      if (rewardItems.length > 0) {
        const rewardItemsByItemId = new Map<string, number>();
        for (const item of rewardItems) {
          rewardItemsByItemId.set(item.itemId, (rewardItemsByItemId.get(item.itemId) ?? 0) + item.quantity);
        }

        const rewardItemIds = [...rewardItemsByItemId.keys()];
        const existingItems = await transaction.item.findMany({
          where: {
            id: {
              in: rewardItemIds,
            },
          },
          select: {
            id: true,
          },
        });
        if (existingItems.length !== rewardItemIds.length) {
          throw new AppError(404, "ITEM_NOT_FOUND", "One or more quest reward items were not found");
        }

        for (const [itemId, quantity] of rewardItemsByItemId.entries()) {
          await this.addItemToInventoryTx(transaction, inventory, itemId, quantity);
        }
        await this.syncInventoryLayoutTx(transaction, userId);
      }

      const progression = await this.addExperienceToPrimaryTx(transaction, userId, rewardXp);
      const activeQuests = await this.listActiveQuestsTx(transaction, userId);
      const completedQuests = await transaction.playerQuest.findMany({
        where: {
          userId,
          status: "COMPLETED",
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 80,
      });

      return {
        delivered: true,
        quest: toQuestOutput(completedQuest),
        rewardBits,
        rewardXp,
        inventoryBits,
        level: progression.level,
        experience: progression.experience,
        experienceMax: progression.experienceMax,
        activeQuests,
        completedQuests: completedQuests.map(toQuestOutput),
      };
    });
  }

  async registerTalk(userId: string, input: RegisterNpcTalkInput) {
    return prisma.$transaction(async (transaction) => {
      const activeQuests = await this.applyQuestProgressUpdateTx(transaction, userId, (objective) => {
        if (objective.type !== "TALK" || objective.npcId !== input.npcId || objective.completed) {
          return objective;
        }

        return {
          ...objective,
          current: objective.required,
          completed: true,
        };
      });

      return {
        activeQuests,
      };
    });
  }

  async registerEnemyDefeat(userId: string, input: RegisterEnemyDefeatInput): Promise<RegisterEnemyDefeatOutput> {
    const bestiary = await prisma.bestiaryAnima.findUnique({
      where: { id: input.bestiaryAnimaId },
      select: {
        bitsDrop: true,
        xpDrop: true,
      },
    });
    if (!bestiary) {
      throw new AppError(404, "BESTIARY_ANIMA_NOT_FOUND", "Bestiary anima not found");
    }

    return prisma.$transaction(async (transaction) => {
      const multipliers = await this.getRewardMultipliersTx(transaction);
      const bitsGained = clampInt(bestiary.bitsDrop * multipliers.bitsMultiplier, 0, 99_999_999);
      const xpGained = clampInt(bestiary.xpDrop * multipliers.expMultiplier, 0, 99_999_999);
      const inventoryBits = await this.addBitsTx(transaction, userId, bitsGained);
      const progression = await this.addExperienceToPrimaryTx(transaction, userId, xpGained);

      const droppedItemQuantityById = new Map<string, number>();
      for (const drop of input.droppedItems) {
        droppedItemQuantityById.set(drop.itemId, (droppedItemQuantityById.get(drop.itemId) ?? 0) + Math.max(1, Math.floor(drop.quantity)));
      }

      const activeQuests = await this.applyQuestProgressUpdateTx(transaction, userId, (objective) => {
        if (objective.type === "KILL" && objective.bestiaryAnimaId === input.bestiaryAnimaId && !objective.completed) {
          const nextCurrent = clampInt(objective.current + 1, 0, objective.required);
          return {
            ...objective,
            current: nextCurrent,
            completed: nextCurrent >= objective.required,
          };
        }

        if (objective.type === "DROP" && !objective.completed) {
          const increment = droppedItemQuantityById.get(objective.itemId) ?? 0;
          if (increment <= 0) {
            return objective;
          }
          const nextCurrent = clampInt(objective.current + increment, 0, objective.required);
          return {
            ...objective,
            current: nextCurrent,
            completed: nextCurrent >= objective.required,
          };
        }

        return objective;
      });

      return {
        bitsGained,
        xpGained,
        inventoryBits,
        level: progression.level,
        experience: progression.experience,
        experienceMax: progression.experienceMax,
        activeQuests,
      };
    });
  }

  async buy(userId: string, input: NpcBuyInput) {
    const { dialog } = await this.resolveNpcDialog({
      npcId: input.npcId,
      dialogId: input.dialogId,
      allowedAction: ["SHOP_BUY"],
    });

    const offer = dialog.buyOffers.find((entry) => entry.id === input.offerId) ?? null;
    if (!offer) {
      throw new AppError(404, "NPC_BUY_OFFER_NOT_FOUND", "Buy offer not found");
    }

    const quantity = clampInt(input.quantity ?? 1, 1, 9999);
    const totalCost = offer.bitsCost * quantity;
    const totalItems = offer.quantity * quantity;

    const item = await prisma.item.findUnique({
      where: { id: offer.itemId },
      select: { id: true },
    });
    if (!item) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item not found");
    }

    const result = await prisma.$transaction(async (transaction) => {
      const inventory = await this.getOrCreateInventoryTx(transaction, userId);
      if (inventory.bits < totalCost) {
        throw new AppError(400, "INSUFFICIENT_BITS", "Insufficient bits");
      }

      await transaction.userInventory.update({
        where: { id: inventory.id },
        data: {
          bits: inventory.bits - totalCost,
        },
      });

      await this.addItemToInventoryTx(transaction, inventory, offer.itemId, totalItems);
      const updated = await this.syncInventoryLayoutTx(transaction, userId);
      return {
        bits: updated.bits,
      };
    });

    return {
      bought: true,
      bits: result.bits,
      itemId: offer.itemId,
      quantity: totalItems,
    };
  }

  async craft(userId: string, input: NpcCraftInput) {
    const { dialog } = await this.resolveNpcDialog({
      npcId: input.npcId,
      dialogId: input.dialogId,
      allowedAction: ["SHOP_CRAFT"],
    });

    const recipe = dialog.craftRecipes.find((entry) => entry.id === input.recipeId) ?? null;
    if (!recipe) {
      throw new AppError(404, "NPC_CRAFT_RECIPE_NOT_FOUND", "Craft recipe not found");
    }

    const quantity = clampInt(input.quantity ?? 1, 1, 9999);
    const requiredByItemId = recipe.requirements.map((requirement) => ({
      itemId: requirement.itemId,
      quantity: requirement.quantity * quantity,
    }));
    const uniqueRequirementItemIds = [...new Set(requiredByItemId.map((entry) => entry.itemId))];

    const [resultItem, requirementItems] = await Promise.all([
      prisma.item.findUnique({
        where: { id: recipe.resultItemId },
        select: { id: true },
      }),
      prisma.item.findMany({
        where: {
          id: {
            in: uniqueRequirementItemIds,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);
    if (!resultItem) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Result item not found");
    }
    if (requirementItems.length !== uniqueRequirementItemIds.length) {
      throw new AppError(404, "ITEM_NOT_FOUND", "One or more requirement items were not found");
    }

    const craftedQuantity = recipe.resultQuantity * quantity;
    const result = await prisma.$transaction(async (transaction) => {
      const inventory = await this.getOrCreateInventoryTx(transaction, userId);
      const inventoryItemsByItemId = new Map(inventory.items.map((entry) => [entry.itemId, entry]));

      for (const requirement of requiredByItemId) {
        const existing = inventoryItemsByItemId.get(requirement.itemId) ?? null;
        if (!existing || existing.quantity < requirement.quantity) {
          throw new AppError(400, "INSUFFICIENT_CRAFT_ITEMS", "Insufficient items to craft");
        }
      }

      for (const requirement of requiredByItemId) {
        const existing = inventoryItemsByItemId.get(requirement.itemId)!;
        const remaining = existing.quantity - requirement.quantity;
        if (remaining > 0) {
          await transaction.userInventoryItem.update({
            where: { id: existing.id },
            data: {
              quantity: remaining,
            },
          });
        } else {
          await transaction.userInventoryItem.delete({
            where: { id: existing.id },
          });
        }
      }

      const refreshedInventory = await this.getOrCreateInventoryTx(transaction, userId);
      await this.addItemToInventoryTx(transaction, refreshedInventory, recipe.resultItemId, craftedQuantity);
      const updated = await this.syncInventoryLayoutTx(transaction, userId);
      return {
        bits: updated.bits,
      };
    });

    return {
      crafted: true,
      bits: result.bits,
      itemId: recipe.resultItemId,
      quantity: craftedQuantity,
    };
  }
}
