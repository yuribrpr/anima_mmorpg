import type { PowerLevel } from "./anima";

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
};

export type UpdateBestiaryAnimaInput = CreateBestiaryAnimaInput;
