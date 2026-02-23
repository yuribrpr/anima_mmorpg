import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { collectInventoryDropSchema, updateInventoryHotbarSchema, updateInventoryLayoutSchema, useInventoryItemSchema } from "./inventory.schemas";
import { InventoryService } from "./inventory.service";

export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  getByUser = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const inventory = await this.inventoryService.getByUserId(request.authUserId);
      response.status(200).json({ inventory });
    } catch (error) {
      next(error);
    }
  };

  updateLayout = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = updateInventoryLayoutSchema.parse(request.body);
      const inventory = await this.inventoryService.updateLayout(request.authUserId, input);
      response.status(200).json({ inventory });
    } catch (error) {
      next(error);
    }
  };

  updateHotbar = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = updateInventoryHotbarSchema.parse(request.body);
      const inventory = await this.inventoryService.updateHotbar(request.authUserId, input);
      response.status(200).json({ inventory });
    } catch (error) {
      next(error);
    }
  };

  collectDrop = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = collectInventoryDropSchema.parse(request.body);
      const inventory = await this.inventoryService.collectDrop(request.authUserId, input);
      response.status(200).json({ inventory });
    } catch (error) {
      next(error);
    }
  };

  useItem = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = useInventoryItemSchema.parse(request.body);
      const result = await this.inventoryService.useItem(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
