import type { NextFunction, Request, Response } from "express";
import { createItemSchema, itemParamsSchema, updateItemSchema } from "./item.schemas";
import { ItemService } from "./item.service";

export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const items = await this.itemService.list();
      response.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createItemSchema.parse(request.body);
      const item = await this.itemService.create(input);
      response.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = itemParamsSchema.parse(request.params);
      const input = updateItemSchema.parse(request.body);
      const item = await this.itemService.update(params.id, input);
      response.status(200).json({ item });
    } catch (error) {
      next(error);
    }
  };

  delete = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = itemParamsSchema.parse(request.params);
      await this.itemService.delete(params.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  gallery = (_request: Request, response: Response) => {
    response.status(200).json({ gallery: this.itemService.getGallery() });
  };
}
