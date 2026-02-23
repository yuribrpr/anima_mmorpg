import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin";
import { authMiddleware } from "../../middlewares/auth";
import type { ItemRepository } from "./item.repository";
import { ItemController } from "./item.controller";
import { ItemService } from "./item.service";

export const createItemRouter = (itemRepository: ItemRepository) => {
  const router = Router();
  const itemService = new ItemService(itemRepository);
  const itemController = new ItemController(itemService);

  router.use(authMiddleware);
  router.use(adminMiddleware);
  router.get("/", itemController.list);
  router.get("/galeria", itemController.gallery);
  router.post("/", itemController.create);
  router.put("/:id", itemController.update);
  router.delete("/:id", itemController.delete);

  return router;
};
