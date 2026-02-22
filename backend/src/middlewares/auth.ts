import { NextFunction, Request, Response } from "express";
import { getEnv } from "../config/env";
import { AppError } from "../lib/errors";
import { verifyAuthToken } from "../lib/jwt";

export const authMiddleware = (request: Request, _response: Response, next: NextFunction) => {
  const token = request.cookies[getEnv().COOKIE_NAME] as string | undefined;

  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    const payload = verifyAuthToken(token);
    request.authUserId = payload.sub;
    request.authUserRole = payload.role;
    next();
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid session");
  }
};
