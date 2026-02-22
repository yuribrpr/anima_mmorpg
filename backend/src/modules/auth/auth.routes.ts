import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../../middlewares/auth";
import { AuthController } from "./auth.controller";
import { UserRepository } from "./auth.repository";
import { AuthService } from "./auth.service";

export const createAuthRouter = (userRepository: UserRepository) => {
  const router = Router();

  const authService = new AuthService(userRepository);
  const authController = new AuthController(authService);

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many login attempts. Try again in one minute.",
      },
    },
  });

  router.post("/register", authController.register);
  router.post("/login", loginLimiter, authController.login);
  router.post("/logout", authController.logout);
  router.get("/me", authMiddleware, authController.me);

  return router;
};
