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

export type QuestRewardItem = {
  id: string;
  itemId: string;
  itemName: string | null;
  quantity: number;
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

export type NpcDefinitionOutput = {
  id: string;
  name: string;
  imageData: string | null;
  dialogs: NpcDialog[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateNpcDefinitionInput = {
  name: string;
  imageData: string | null;
  dialogs: NpcDialog[];
};

export type UpdateNpcDefinitionInput = CreateNpcDefinitionInput;

export type AcceptNpcQuestInput = {
  npcId: string;
  dialogId: string;
};

export type DeliverNpcQuestInput = {
  npcId: string;
  questId: string;
};

export type RegisterNpcTalkInput = {
  npcId: string;
};

export type NpcBuyInput = {
  npcId: string;
  dialogId: string;
  offerId: string;
  quantity?: number;
};

export type NpcCraftInput = {
  npcId: string;
  dialogId: string;
  recipeId: string;
  quantity?: number;
};

export type EnemyDefeatedDropInput = {
  itemId: string;
  quantity: number;
};

export type RegisterEnemyDefeatInput = {
  bestiaryAnimaId: string;
  droppedItems: EnemyDefeatedDropInput[];
};

export type PlayerQuestObjectiveProgress =
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

export type PlayerQuestOutput = {
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
  completedAt: Date | null;
  objectives: PlayerQuestObjectiveProgress[];
  createdAt: Date;
  updatedAt: Date;
};

export type DeliverNpcQuestOutput = {
  delivered: true;
  quest: PlayerQuestOutput;
  rewardBits: number;
  rewardXp: number;
  inventoryBits: number;
  level: number;
  experience: number;
  experienceMax: number;
  activeQuests: PlayerQuestOutput[];
  completedQuests: PlayerQuestOutput[];
};

export type RegisterEnemyDefeatOutput = {
  bitsGained: number;
  xpGained: number;
  inventoryBits: number;
  level: number;
  experience: number;
  experienceMax: number;
  activeQuests: PlayerQuestOutput[];
};
