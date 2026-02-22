import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default("anima-mmo-local-secret-key"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  COOKIE_NAME: z.string().default("anima_token"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().positive().default(3000),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
});

export const getEnv = () => {
  const parsed = EnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL ?? "mysql://root:Luk3skywalker!@localhost:3306/anima_mmo",
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    COOKIE_NAME: process.env.COOKIE_NAME,
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    PORT: process.env.PORT,
    BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS,
  });

  return parsed;
};
