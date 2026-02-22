import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

export const adminMiddleware = (request: Request, _response: Response, next: NextFunction) => {
  if (!request.authUserId) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }

  if (request.authUserRole !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Admin access required");
  }

  next();
};
