import { PowerLevel } from "./anima";

export type BestiaryDropInput = {
  itemId: string;
  quantity: number;
  dropChance: number;
};

export type CreateBestiaryAnimaInput = {
  name: string;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
  imageData?: string | null;
  spriteScale?: number;
  flipHorizontal?: boolean;
  powerLevel: PowerLevel;
  bitsDrop?: number;
  xpDrop?: number;
  drops?: BestiaryDropInput[];
};

export type UpdateBestiaryAnimaInput = CreateBestiaryAnimaInput;
