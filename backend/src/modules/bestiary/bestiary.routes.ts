import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin";
import { authMiddleware } from "../../middlewares/auth";
import { BestiaryAnimaController } from "./bestiary.controller";
import { BestiaryAnimaRepository } from "./bestiary.repository";
import { BestiaryAnimaService } from "./bestiary.service";

export const createBestiaryAnimaRouter = (bestiaryAnimaRepository: BestiaryAnimaRepository) => {
  const router = Router();
  const service = new BestiaryAnimaService(bestiaryAnimaRepository);
  const controller = new BestiaryAnimaController(service);

  router.use(authMiddleware);
  router.get("/", controller.list);

  router.use(adminMiddleware);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.delete);

  return router;
};
