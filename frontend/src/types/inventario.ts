export type InventoryItemLayout = {
  itemId: string;
  slot: number;
};

export type InventoryItem = {
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

export type UserInventory = {
  bits: number;
  crystals: number;
  totalSlots: number;
  lockedSlotStart: number;
  layout: InventoryItemLayout[];
  hotbar: Array<string | null>;
  items: InventoryItem[];
  updatedAt: string;
};

export type UseInventoryItemResult = {
  inventory: UserInventory;
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
