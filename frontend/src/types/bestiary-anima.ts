import type { PowerLevel } from "./anima";
import type { Item } from "./item";

export type BestiaryDrop = {
  id: string;
  itemId: string;
  quantity: number;
  dropChance: number;
  item: Item;
};

export type BestiaryDropInput = {
  itemId: string;
  quantity: number;
  dropChance: number;
};

export type BestiaryAnima = {
  id: string;
  name: string;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
  imageData: string | null;
  spriteScale: number;
  flipHorizontal: boolean;
  powerLevel: PowerLevel;
  bitsDrop: number;
  xpDrop: number;
  drops: BestiaryDrop[];
  createdAt: string;
  updatedAt: string;
};

export type CreateBestiaryAnimaInput = {
  name: string;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
  imageData: string | null;
  spriteScale: number;
  flipHorizontal: boolean;
  powerLevel: PowerLevel;
  drops: BestiaryDropInput[];
};

export type UpdateBestiaryAnimaInput = CreateBestiaryAnimaInput;
