import { PowerLevel } from "./anima";

export type AdoptAnimaInput = {
  animaId: string;
  nickname: string;
};

export type AdoptionCandidateOutput = {
  id: string;
  name: string;
  imageData: string | null;
  spriteScale: number;
  flipHorizontal: boolean;
  powerLevel: PowerLevel;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
  nextEvolutionLevelRequired: number;
  nextEvolution: {
    id: string;
    name: string;
    imageData: string | null;
  } | null;
  previousEvolution: {
    id: string;
    name: string;
    imageData: string | null;
  } | null;
};

export type AdoptedAnimaOutput = {
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
  isNextEvolutionUnlocked: boolean;
  totalAttack: number;
  totalDefense: number;
  totalMaxHp: number;
  totalAttackSpeedSeconds: number;
  totalCritChance: number;
  baseAnima: AdoptionCandidateOutput;
  createdAt: Date;
  updatedAt: Date;
};

export type UnlockAdoptedEvolutionOutput = {
  unlocked: boolean;
  anima: AdoptedAnimaOutput;
};

export type EvolveAdoptedAnimaOutput = {
  evolved: boolean;
  anima: AdoptedAnimaOutput;
};

export type RegressAdoptedAnimaOutput = {
  regressed: boolean;
  anima: AdoptedAnimaOutput;
};

export type EvolutionChainNodeOutput = {
  id: string;
  name: string;
  imageData: string | null;
  levelRequiredFromPrevious: number | null;
};

export type AdoptionEvolutionChainOutput = {
  adoptedAnimaId: string;
  currentBaseAnimaId: string;
  currentIndex: number;
  chain: EvolutionChainNodeOutput[];
};
