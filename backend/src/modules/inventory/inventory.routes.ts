import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import type { InventoryRepository } from "./inventory.repository";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

export const createInventoryRouter = (inventoryRepository: InventoryRepository) => {
  const router = Router();
  const service = new InventoryService(inventoryRepository);
  const controller = new InventoryController(service);

  router.use(authMiddleware);
  router.get("/", controller.getByUser);
  router.patch("/layout", controller.updateLayout);
  router.post("/coletar-drop", controller.collectDrop);
  router.post("/usar", controller.useItem);

  return router;
};
