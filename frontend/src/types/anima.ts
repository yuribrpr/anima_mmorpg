export type PowerLevel = "ROOKIE" | "CHAMPION" | "ULTIMATE" | "MEGA" | "BURST_MODE";

export type PowerLevelOption = {
  value: PowerLevel;
  label: string;
};

export const POWER_LEVEL_OPTIONS: PowerLevelOption[] = [
  { value: "ROOKIE", label: "Rookie" },
  { value: "CHAMPION", label: "Champion" },
  { value: "ULTIMATE", label: "Ultimate" },
  { value: "MEGA", label: "Mega" },
  { value: "BURST_MODE", label: "Burst Mode" },
];

export type AnimaReference = {
  id: string;
  name: string;
  imageData: string | null;
};

export type Anima = {
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
  nextEvolution: AnimaReference | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAnimaInput = {
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
};

export type UpdateAnimaInput = CreateAnimaInput;
