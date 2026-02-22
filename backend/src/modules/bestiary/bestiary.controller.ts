import { NextFunction, Request, Response } from "express";
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
}
