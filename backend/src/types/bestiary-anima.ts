import { PowerLevel } from "./anima";

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
};

export type UpdateBestiaryAnimaInput = CreateBestiaryAnimaInput;
