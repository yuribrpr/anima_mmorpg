import { NextFunction, Request, Response } from "express";

export const notFoundMiddleware = (_request: Request, response: Response, _next: NextFunction) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
};
