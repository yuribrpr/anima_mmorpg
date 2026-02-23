import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin";
import { authMiddleware } from "../../middlewares/auth";
import { GlobalSettingsController } from "./global-settings.controller";
import { GlobalSettingsService } from "./global-settings.service";

export const createGlobalSettingsRouter = () => {
  const router = Router();
  const service = new GlobalSettingsService();
  const controller = new GlobalSettingsController(service);

  router.use(authMiddleware);
  router.get("/", controller.get);

  router.use(adminMiddleware);
  router.patch("/", controller.update);

  return router;
};
