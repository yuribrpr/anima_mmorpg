import { NextFunction, Request, Response } from "express";
import { createAnimaSchema, deleteAnimaParamsSchema, updateAnimaSchema } from "./anima.schemas";
import { AnimaService } from "./anima.service";

export class AnimaController {
  constructor(private readonly animaService: AnimaService) {}

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const animas = await this.animaService.list();
      response.status(200).json({ animas });
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createAnimaSchema.parse(request.body);
      const anima = await this.animaService.create(input);

      response.status(201).json({ anima });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = deleteAnimaParamsSchema.parse(request.params);
      const input = updateAnimaSchema.parse(request.body);
      const anima = await this.animaService.update(params.id, input);

      response.status(200).json({ anima });
    } catch (error) {
      next(error);
    }
  };

  delete = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = deleteAnimaParamsSchema.parse(request.params);
      await this.animaService.delete(params.id);

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
