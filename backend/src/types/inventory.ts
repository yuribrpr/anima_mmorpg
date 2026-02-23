export type InventoryItemLayout = {
  itemId: string;
  slot: number;
};

export type InventoryItemOutput = {
  itemId: string;
  quantity: number;
  slot: number | null;
  item: {
    id: string;
    name: string;
    description: string;
    type: "CONSUMIVEL" | "QUEST" | "NORMAL";
    imageData: string | null;
    stackSize: number;
    healPercentMaxHp: number;
    bonusAttack: number;
    bonusDefense: number;
    bonusMaxHp: number;
  };
};

export type UserInventoryOutput = {
  bits: number;
  crystals: number;
  totalSlots: number;
  lockedSlotStart: number;
  layout: InventoryItemLayout[];
  items: InventoryItemOutput[];
  updatedAt: Date;
};

export type UpdateInventoryLayoutInput = {
  layout: InventoryItemLayout[];
};

export type CollectInventoryDropInput = {
  itemId: string;
  quantity: number;
};

export type UseInventoryItemInput = {
  itemId: string;
  quantity?: number;
};

export type UseInventoryItemResult = {
  inventory: UserInventoryOutput;
  appliedEffect: {
    adoptedAnimaId: string;
    nickname: string;
    healedHp: number;
    bonusAttackAdded: number;
    bonusDefenseAdded: number;
    bonusMaxHpAdded: number;
    currentHp: number;
    totalMaxHp: number;
  } | null;
};
