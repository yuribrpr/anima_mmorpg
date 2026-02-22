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
  powerLevel: PowerLevel;
};

export type UpdateBestiaryAnimaInput = CreateBestiaryAnimaInput;
