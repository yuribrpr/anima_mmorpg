import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { getEnv } from "../config/env";

type TokenPayload = {
  sub: string;
};

export const signAuthToken = (userId: string) => {
  const env = getEnv();

  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

export const verifyAuthToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, getEnv().JWT_SECRET);

  if (typeof decoded !== "object" || !decoded || typeof decoded.sub !== "string") {
    throw new Error("Invalid token payload");
  }

  return { sub: decoded.sub };
};
