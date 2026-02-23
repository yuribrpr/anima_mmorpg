import type { MapNpcPlacementConfig } from "./mapa";

export type NpcDialogActionType = "NONE" | "QUEST" | "SHOP_BUY" | "SHOP_CRAFT";
export type QuestType = "MAIN" | "SUB" | "DAILY" | "REPEATABLE";

export type QuestKillObjective = {
  id: string;
  bestiaryAnimaId: string;
  bestiaryName: string | null;
  quantity: number;
};

export type QuestDropObjective = {
  id: string;
  itemId: string;
  itemName: string | null;
  quantity: number;
};

export type QuestRewardItem = {
  id: string;
  itemId: string;
  itemName: string | null;
  quantity: number;
};

export type QuestTemplate = {
  questType: QuestType;
  title: string;
  description: string;
  talkToNpcId: string | null;
  talkToNpcName: string | null;
  rewardBits: number;
  rewardXp: number;
  rewardItems: QuestRewardItem[];
  killObjectives: QuestKillObjective[];
  dropObjectives: QuestDropObjective[];
};

export type NpcShopBuyOffer = {
  id: string;
  itemId: string;
  itemName: string | null;
  description: string;
  quantity: number;
  bitsCost: number;
};

export type NpcCraftRequirement = {
  itemId: string;
  itemName: string | null;
  quantity: number;
};

export type NpcShopCraftRecipe = {
  id: string;
  resultItemId: string;
  resultItemName: string | null;
  description: string;
  resultQuantity: number;
  requirements: NpcCraftRequirement[];
};

export type NpcDialog = {
  id: string;
  text: string;
  actionType: NpcDialogActionType;
  quest: QuestTemplate | null;
  buyOffers: NpcShopBuyOffer[];
  craftRecipes: NpcShopCraftRecipe[];
};

export type NpcDefinition = {
  id: string;
  name: string;
  imageData: string | null;
  dialogs: NpcDialog[];
  createdAt: string;
  updatedAt: string;
};

export type CreateNpcDefinitionInput = {
  name: string;
  imageData: string | null;
  dialogs: NpcDialog[];
};

export type UpdateNpcDefinitionInput = CreateNpcDefinitionInput;

export type ActiveMapNpc = MapNpcPlacementConfig & {
  npc: NpcDefinition | null;
};

export type PlayerQuestObjective =
  | {
      id: string;
      type: "TALK";
      npcId: string;
      npcName: string | null;
      required: number;
      current: number;
      completed: boolean;
    }
  | {
      id: string;
      type: "KILL";
      bestiaryAnimaId: string;
      bestiaryName: string | null;
      required: number;
      current: number;
      completed: boolean;
    }
  | {
      id: string;
      type: "DROP";
      itemId: string;
      itemName: string | null;
      required: number;
      current: number;
      completed: boolean;
    };

export type PlayerQuest = {
  id: string;
  questKey: string;
  sourceNpcId: string;
  sourceNpcName: string;
  questType: QuestType;
  turnInReady: boolean;
  rewardBits: number;
  rewardXp: number;
  rewardItems: QuestRewardItem[];
  title: string;
  description: string;
  status: "ACTIVE" | "COMPLETED";
  completedAt: string | null;
  objectives: PlayerQuestObjective[];
  createdAt: string;
  updatedAt: string;
};

export type RegisterEnemyDefeatResult = {
  bitsGained: number;
  xpGained: number;
  inventoryBits: number;
  level: number;
  experience: number;
  experienceMax: number;
  activeQuests: PlayerQuest[];
};

export type DeliverNpcQuestResult = {
  delivered: true;
  quest: PlayerQuest;
  rewardBits: number;
  rewardXp: number;
  inventoryBits: number;
  level: number;
  experience: number;
  experienceMax: number;
  activeQuests: PlayerQuest[];
  completedQuests: PlayerQuest[];
};
