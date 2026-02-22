import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import { AnimaRepository } from "./anima.repository";
import { AnimaController } from "./anima.controller";
import { AnimaService } from "./anima.service";

export const createAnimaRouter = (animaRepository: AnimaRepository) => {
  const router = Router();
  const animaService = new AnimaService(animaRepository);
  const animaController = new AnimaController(animaService);

  router.use(authMiddleware);
  router.get("/", animaController.list);
  router.post("/", animaController.create);
  router.put("/:id", animaController.update);
  router.delete("/:id", animaController.delete);

  return router;
};
