import { z } from "zod";

const powerLevelSchema = z.enum(["ROOKIE", "CHAMPION", "ULTIMATE", "MEGA", "BURST_MODE"]);
const dropSchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(9999),
  dropChance: z.number().min(0).max(100),
});

export const createBestiaryAnimaSchema = z.object({
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
  drops: z.array(dropSchema).max(30).optional().default([]),
});

export const updateBestiaryAnimaSchema = createBestiaryAnimaSchema;

export const bestiaryAnimaParamsSchema = z.object({
  id: z.string().min(1),
});
