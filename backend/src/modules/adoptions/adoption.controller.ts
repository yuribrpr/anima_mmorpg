import { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { adoptAnimaSchema, adoptionParamsSchema } from "./adoption.schemas";
import { AdoptionService } from "./adoption.service";

export class AdoptionController {
  constructor(private readonly adoptionService: AdoptionService) {}

  listCandidates = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const animas = await this.adoptionService.listCandidates();
      response.status(200).json({ animas });
    } catch (error) {
      next(error);
    }
  };

  adopt = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = adoptAnimaSchema.parse(request.body);
      const anima = await this.adoptionService.adopt(request.authUserId, input);
      response.status(201).json({ anima });
    } catch (error) {
      next(error);
    }
  };

  listInventory = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const animas = await this.adoptionService.listInventory(request.authUserId);
      response.status(200).json({ animas });
    } catch (error) {
      next(error);
    }
  };

  setPrimary = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const params = adoptionParamsSchema.parse(request.params);
      const anima = await this.adoptionService.setPrimary(request.authUserId, params.id);
      response.status(200).json({ anima });
    } catch (error) {
      next(error);
    }
  };

  unlockNextEvolution = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const params = adoptionParamsSchema.parse(request.params);
      const anima = await this.adoptionService.unlockNextEvolution(request.authUserId, params.id);
      response.status(200).json({ unlocked: true, anima });
    } catch (error) {
      next(error);
    }
  };

  evolveToNext = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const params = adoptionParamsSchema.parse(request.params);
      const anima = await this.adoptionService.evolveToNext(request.authUserId, params.id);
      response.status(200).json({ evolved: true, anima });
    } catch (error) {
      next(error);
    }
  };

  regressToPrevious = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const params = adoptionParamsSchema.parse(request.params);
      const anima = await this.adoptionService.regressToPrevious(request.authUserId, params.id);
      response.status(200).json({ regressed: true, anima });
    } catch (error) {
      next(error);
    }
  };

  getEvolutionChain = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const params = adoptionParamsSchema.parse(request.params);
      const chain = await this.adoptionService.getEvolutionChain(request.authUserId, params.id);
      response.status(200).json(chain);
    } catch (error) {
      next(error);
    }
  };
}
