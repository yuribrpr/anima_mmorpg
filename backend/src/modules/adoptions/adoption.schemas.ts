import { z } from "zod";

export const adoptAnimaSchema = z.object({
  animaId: z.string().min(1),
  nickname: z.string().trim().min(2).max(30),
});

export const adoptionParamsSchema = z.object({
  id: z.string().min(1),
});
