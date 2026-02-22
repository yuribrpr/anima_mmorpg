import type { PowerLevel } from "./anima";

export type AdoptionCandidate = {
  id: string;
  name: string;
  imageData: string | null;
  powerLevel: PowerLevel;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
};

export type AdoptAnimaInput = {
  animaId: string;
  nickname: string;
};

export type AdoptedAnima = {
  id: string;
  nickname: string;
  isPrimary: boolean;
  level: number;
  experience: number;
  experienceMax: number;
  currentHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusMaxHp: number;
  attackSpeedReduction: number;
  critChanceBonus: number;
  totalAttack: number;
  totalDefense: number;
  totalMaxHp: number;
  totalAttackSpeedSeconds: number;
  totalCritChance: number;
  baseAnima: AdoptionCandidate;
  createdAt: string;
  updatedAt: string;
};
