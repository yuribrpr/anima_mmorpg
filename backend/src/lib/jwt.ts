import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { getEnv } from "../config/env";
import { UserRole } from "../types/auth";

type TokenPayload = {
  sub: string;
  role: UserRole;
};

export const signAuthToken = (userId: string, role: UserRole) => {
  const env = getEnv();

  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

export const verifyAuthToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, getEnv().JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    !decoded ||
    typeof decoded.sub !== "string" ||
    (decoded.role !== "PLAYER" && decoded.role !== "ADMIN")
  ) {
    throw new Error("Invalid token payload");
  }

  return { sub: decoded.sub, role: decoded.role };
};
