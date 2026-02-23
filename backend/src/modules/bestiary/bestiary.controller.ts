import { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { bestiaryAnimaParamsSchema, createBestiaryAnimaSchema, updateBestiaryAnimaSchema } from "./bestiary.schemas";
import { BestiaryAnimaService } from "./bestiary.service";

export class BestiaryAnimaController {
  constructor(private readonly bestiaryAnimaService: BestiaryAnimaService) {}

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const animas = await this.bestiaryAnimaService.list();
      response.status(200).json({ animas });
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createBestiaryAnimaSchema.parse(request.body);
      const anima = await this.bestiaryAnimaService.create(input);
      response.status(201).json({ anima });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = bestiaryAnimaParamsSchema.parse(request.params);
      const input = updateBestiaryAnimaSchema.parse(request.body);
      const anima = await this.bestiaryAnimaService.update(params.id, input);
      response.status(200).json({ anima });
    } catch (error) {
      next(error);
    }
  };

  delete = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const bodyId = request.body && typeof request.body === "object" && "id" in request.body ? request.body.id : undefined;
      const candidateId = request.params.id ?? request.query.id ?? bodyId;
      const id = typeof candidateId === "string" ? candidateId.trim() : "";
      if (!id) {
        throw new AppError(400, "BESTIARY_ANIMA_ID_REQUIRED", "Bestiary anima id is required");
      }
      await this.bestiaryAnimaService.delete(id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
