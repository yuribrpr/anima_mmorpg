import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { updateGlobalSettingsSchema } from "./global-settings.schemas";
import { GlobalSettingsService } from "./global-settings.service";

export class GlobalSettingsController {
  constructor(private readonly globalSettingsService: GlobalSettingsService) {}

  get = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const settings = await this.globalSettingsService.get();
      response.status(200).json({ settings });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = updateGlobalSettingsSchema.parse(request.body);
      const settings = await this.globalSettingsService.update(input);
      response.status(200).json({ settings });
    } catch (error) {
      next(error);
    }
  };
}
