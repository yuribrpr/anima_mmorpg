import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin";
import { authMiddleware } from "../../middlewares/auth";
import { MapController } from "./map.controller";
import { MapRepository } from "./map.repository";
import { MapService } from "./map.service";

export const createMapRouter = (mapRepository: MapRepository) => {
  const router = Router();
  const mapService = new MapService(mapRepository);
  const mapController = new MapController(mapService);

  router.use(authMiddleware);
  router.get("/ativo", mapController.getActive);
  router.patch("/ativo/estado", mapController.updateActiveState);

  router.use(adminMiddleware);
  router.get("/", mapController.list);
  router.post("/", mapController.create);
  router.get("/:id", mapController.getById);
  router.patch("/:id/layout", mapController.updateLayout);
  router.patch("/:id/assets", mapController.updateAssets);
  router.patch("/:id/ativar", mapController.activate);

  return router;
};
