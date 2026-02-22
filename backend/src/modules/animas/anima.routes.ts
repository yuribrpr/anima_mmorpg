import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin";
import { authMiddleware } from "../../middlewares/auth";
import { AnimaController } from "./anima.controller";
import { AnimaRepository } from "./anima.repository";
import { AnimaService } from "./anima.service";

export const createAnimaRouter = (animaRepository: AnimaRepository) => {
  const router = Router();
  const animaService = new AnimaService(animaRepository);
  const animaController = new AnimaController(animaService);

  router.use(authMiddleware);
  router.use(adminMiddleware);
  router.get("/", animaController.list);
  router.post("/", animaController.create);
  router.put("/:id", animaController.update);
  router.delete("/:id", animaController.delete);

  return router;
};
