import { NextFunction, Request, Response } from "express";
import { clearAuthCookie, setAuthCookie } from "../../lib/cookies";
import { AppError } from "../../lib/errors";
import { loginSchema, registerSchema } from "./auth.schemas";
import { AuthService } from "./auth.service";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = registerSchema.parse(request.body);
      const { user, token } = await this.authService.register(input);

      setAuthCookie(response, token);
      response.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  };

  login = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = loginSchema.parse(request.body);
      const { user, token } = await this.authService.login(input);

      setAuthCookie(response, token);
      response.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };

  logout = (_request: Request, response: Response) => {
    clearAuthCookie(response);
    response.status(204).send();
  };

  me = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const user = await this.authService.currentUser(request.authUserId);
      response.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };
}
