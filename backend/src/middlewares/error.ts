import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

export const errorMiddleware = (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: error.issues,
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      response.status(409).json({
        error: {
          code: "RESOURCE_IN_USE",
          message: "Resource is in use and cannot be deleted",
        },
      });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
        },
      });
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    response.status(500).json({
      error: {
        code: "DATABASE_REQUEST_ERROR",
        message: "Database request failed",
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    response.status(400).json({
      error: {
        code: "DATABASE_VALIDATION_ERROR",
        message: "Invalid database request",
      },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large"
  ) {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Uploaded image is too large",
      },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    response.status((error as { status: number }).status).json({
      error: {
        code: "REQUEST_ERROR",
        message: (error as { message: string }).message,
      },
    });
    return;
  }

  console.error("[errorMiddleware] Unhandled error", error);

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
  });
};
