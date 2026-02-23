export type PowerLevel = "ROOKIE" | "CHAMPION" | "ULTIMATE" | "MEGA" | "BURST_MODE";

export type AnimaReference = {
  id: string;
  name: string;
  imageData: string | null;
};

export type AnimaOutput = {
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
  nextEvolutionId: string | null;
  nextEvolutionLevelRequired: number;
  nextEvolution: AnimaReference | null;
  previousEvolutionId: string | null;
  previousEvolution: AnimaReference | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAnimaInput = {
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
  nextEvolutionId?: string | null;
  previousEvolutionId?: string | null;
  nextEvolutionLevelRequired?: number;
};

export type UpdateAnimaInput = CreateAnimaInput;
