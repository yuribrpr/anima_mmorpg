import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import { AnimaRepository } from "../animas/anima.repository";
import { AdoptionController } from "./adoption.controller";
import { AdoptionRepository } from "./adoption.repository";
import { AdoptionService } from "./adoption.service";

export const createAdoptionRouter = (adoptionRepository: AdoptionRepository, animaRepository: AnimaRepository) => {
  const router = Router();
  const service = new AdoptionService(adoptionRepository, animaRepository);
  const controller = new AdoptionController(service);

  router.use(authMiddleware);
  router.get("/candidatos", controller.listCandidates);
  router.get("/", controller.listInventory);
  router.post("/", controller.adopt);
  router.patch("/:id/principal", controller.setPrimary);

  return router;
};
