import { Response } from "express";
import { getEnv } from "../config/env";

export const setAuthCookie = (response: Response, token: string) => {
  const env = getEnv();

  response.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
};

export const clearAuthCookie = (response: Response) => {
  const env = getEnv();

  response.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  });
};
