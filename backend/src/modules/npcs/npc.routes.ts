import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin";
import { authMiddleware } from "../../middlewares/auth";
import { NpcController } from "./npc.controller";
import { NpcService } from "./npc.service";

export const createNpcRouter = () => {
  const router = Router();
  const service = new NpcService();
  const controller = new NpcController(service);

  router.use(authMiddleware);

  router.get("/mapa-ativo", controller.listActiveMap);
  router.get("/quests", controller.listPlayerQuests);
  router.post("/quests/aceitar", controller.acceptQuest);
  router.post("/quests/entregar", controller.deliverQuest);
  router.post("/eventos/falar", controller.registerTalk);
  router.post("/eventos/inimigo-derrotado", controller.registerEnemyDefeat);
  router.post("/loja/comprar", controller.buy);
  router.post("/loja/craftar", controller.craft);

  router.use(adminMiddleware);
  router.get("/", controller.listAdmin);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.delete);

  return router;
};
