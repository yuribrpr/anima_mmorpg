import { z } from "zod";

const powerLevelSchema = z.enum(["ROOKIE", "CHAMPION", "ULTIMATE", "MEGA", "BURST_MODE"]);

export const createBestiaryAnimaSchema = z.object({
  name: z.string().trim().min(2).max(80),
  attack: z.number().int().min(1).max(9999),
  attackSpeedSeconds: z.number().min(0.1).max(30),
  critChance: z.number().min(0).max(100),
  agility: z.number().int().min(1).max(9999),
  defense: z.number().int().min(1).max(9999),
  maxHp: z.number().int().min(1).max(999999),
  imageData: z.string().max(2_000_000).nullable().optional(),
  powerLevel: powerLevelSchema,
});

export const updateBestiaryAnimaSchema = createBestiaryAnimaSchema;

export const bestiaryAnimaParamsSchema = z.object({
  id: z.string().min(1),
});
