export type ItemType = "CONSUMIVEL" | "QUEST" | "NORMAL";

export type Item = {
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
  createdAt: string;
  updatedAt: string;
};

export type ItemGalleryEntry = {
  id: string;
  name: string;
  imageUrl: string;
};

export type CreateItemInput = {
  name: string;
  description: string;
  type: ItemType;
  imageData: string | null;
  stackSize: number;
  healPercentMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusMaxHp: number;
};

export type UpdateItemInput = CreateItemInput;
