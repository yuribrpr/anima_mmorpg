import { z } from "zod";

const powerLevelSchema = z.enum(["ROOKIE", "CHAMPION", "ULTIMATE", "MEGA", "BURST_MODE"]);

export const createAnimaSchema = z.object({
  name: z.string().trim().min(2).max(80),
  attack: z.number().int().min(1).max(9999),
  attackSpeedSeconds: z.number().min(0.1).max(30),
  critChance: z.number().min(0).max(100),
  agility: z.number().int().min(1).max(9999),
  defense: z.number().int().min(1).max(9999),
  maxHp: z.number().int().min(1).max(999999),
  imageData: z.string().max(55_000_000).nullable().optional(),
  spriteScale: z.number().positive().default(3),
  flipHorizontal: z.boolean().default(true),
  powerLevel: powerLevelSchema,
  nextEvolutionId: z.string().min(1).nullable().optional(),
  previousEvolutionId: z.string().min(1).nullable().optional(),
  nextEvolutionLevelRequired: z.number().int().min(1).max(999).default(10),
});

export const updateAnimaSchema = createAnimaSchema;

export const deleteAnimaParamsSchema = z.object({
  id: z.string().min(1),
});

export const powerLevelOutputSchema = powerLevelSchema;
