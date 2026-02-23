import { z } from "zod";

export const updateGlobalSettingsSchema = z.object({
  expMultiplier: z.number().min(0).max(1_000_000),
  bitsMultiplier: z.number().min(0).max(1_000_000),
});
