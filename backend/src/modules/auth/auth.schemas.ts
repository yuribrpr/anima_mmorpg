import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(24),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(3),
  password: z.string().min(8).max(72),
});
