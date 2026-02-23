export const ITEM_TYPES = ["CONSUMIVEL", "QUEST", "NORMAL"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export type ItemGalleryEntry = {
  id: string;
  name: string;
  imageUrl: string;
};

export type ItemOutput = {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  imageData: string | null;
  stackSize: number;
  healPercentMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusMaxHp: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateItemInput = {
  name: string;
  description: string;
  type: ItemType;
  imageData?: string | null;
  stackSize?: number;
  healPercentMaxHp?: number;
  bonusAttack?: number;
  bonusDefense?: number;
  bonusMaxHp?: number;
};

export type UpdateItemInput = CreateItemInput;
