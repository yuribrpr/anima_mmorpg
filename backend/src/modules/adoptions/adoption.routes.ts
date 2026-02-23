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
  router.patch("/:id/evolucoes/desbloquear", controller.unlockNextEvolution);
  router.post("/:id/evolucoes/evoluir", controller.evolveToNext);
  router.post("/:id/evolucoes/regredir", controller.regressToPrevious);
  router.get("/:id/evolucoes/cadeia", controller.getEvolutionChain);

  return router;
};
