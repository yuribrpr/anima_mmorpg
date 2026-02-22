import bcrypt from "bcryptjs";
import { getEnv } from "../config/env";

export const hashPassword = (password: string) => {
  const rounds = getEnv().BCRYPT_ROUNDS;
  return bcrypt.hash(password, rounds);
};

export const verifyPassword = (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};
