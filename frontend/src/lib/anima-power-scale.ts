import type { PowerLevel } from "@/types/anima";

type CoreStats = {
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
};

const BASE_POWER_STATS: Record<PowerLevel, CoreStats> = {
  ROOKIE: { attack: 65, attackSpeedSeconds: 1.8, critChance: 8, agility: 62, defense: 58, maxHp: 520 },
  CHAMPION: { attack: 105, attackSpeedSeconds: 1.5, critChance: 12, agility: 86, defense: 82, maxHp: 840 },
  ULTIMATE: { attack: 150, attackSpeedSeconds: 1.3, critChance: 17, agility: 108, defense: 112, maxHp: 1250 },
  MEGA: { attack: 220, attackSpeedSeconds: 1.1, critChance: 24, agility: 145, defense: 160, maxHp: 1960 },
  BURST_MODE: { attack: 300, attackSpeedSeconds: 0.95, critChance: 32, agility: 192, defense: 220, maxHp: 2900 },
};

export const getPowerScale = (powerLevel: PowerLevel) => {
  const base = BASE_POWER_STATS[powerLevel];
  const scalePercent = Math.floor(Math.random() * 21) + 90;
  const multiplier = scalePercent / 100;

  return {
    scalePercent,
    values: {
      attack: Math.round(base.attack * multiplier),
      attackSpeedSeconds: Number((base.attackSpeedSeconds * (2 - multiplier)).toFixed(2)),
      critChance: Number((base.critChance * multiplier).toFixed(1)),
      agility: Math.round(base.agility * multiplier),
      defense: Math.round(base.defense * multiplier),
      maxHp: Math.round(base.maxHp * multiplier),
    },
  };
};
