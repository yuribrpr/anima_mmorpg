import { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import {
  createMapSchema,
  mapIdParamsSchema,
  usePortalSchema,
  updateActiveMapStateSchema,
  updateMapAssetsSchema,
  updateMapLayoutSchema,
} from "./map.schemas";
import { MapService } from "./map.service";

export class MapController {
  constructor(private readonly mapService: MapService) {}

  getActive = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const payload = await this.mapService.getActiveWithState(request.authUserId);
      response.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  };

  updateActiveState = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = updateActiveMapStateSchema.parse(request.body);
      const state = await this.mapService.updateActiveState(request.authUserId, input);
      response.status(200).json({ state });
    } catch (error) {
      next(error);
    }
  };

  usePortal = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = usePortalSchema.parse(request.body);
      const payload = await this.mapService.usePortal(request.authUserId, input);
      response.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  };

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const maps = await this.mapService.list();
      response.status(200).json({ maps });
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createMapSchema.parse(request.body);
      const map = await this.mapService.create(input);
      response.status(201).json({ map });
    } catch (error) {
      next(error);
    }
  };

  getById = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = mapIdParamsSchema.parse(request.params);
      const map = await this.mapService.getById(params.id);
      response.status(200).json({ map });
    } catch (error) {
      next(error);
    }
  };

  updateLayout = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = mapIdParamsSchema.parse(request.params);
      const input = updateMapLayoutSchema.parse(request.body);
      const map = await this.mapService.updateLayout(params.id, input);
      response.status(200).json({ map });
    } catch (error) {
      next(error);
    }
  };

  updateAssets = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = mapIdParamsSchema.parse(request.params);
      const input = updateMapAssetsSchema.parse(request.body);
      const map = await this.mapService.updateAssets(params.id, input);
      response.status(200).json({ map });
    } catch (error) {
      next(error);
    }
  };

  activate = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = mapIdParamsSchema.parse(request.params);
      const map = await this.mapService.activate(params.id);
      response.status(200).json({ map });
    } catch (error) {
      next(error);
    }
  };
}
