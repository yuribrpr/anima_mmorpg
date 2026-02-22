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
  powerLevel: PowerLevel;
  nextEvolutionId: string | null;
  nextEvolution: AnimaReference | null;
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
  powerLevel: PowerLevel;
  nextEvolutionId?: string | null;
};

export type UpdateAnimaInput = CreateAnimaInput;
