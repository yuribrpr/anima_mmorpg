import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { getEnv } from "./config/env";
import { errorMiddleware } from "./middlewares/error";
import { notFoundMiddleware } from "./middlewares/not-found";
import { createAnimaRouter } from "./modules/animas/anima.routes";
import { AnimaRepository, PrismaAnimaRepository } from "./modules/animas/anima.repository";
import { createAdoptionRouter } from "./modules/adoptions/adoption.routes";
import { AdoptionRepository, PrismaAdoptionRepository } from "./modules/adoptions/adoption.repository";
import { createBestiaryAnimaRouter } from "./modules/bestiary/bestiary.routes";
import { BestiaryAnimaRepository, PrismaBestiaryAnimaRepository } from "./modules/bestiary/bestiary.repository";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { PrismaUserRepository, UserRepository } from "./modules/auth/auth.repository";

type AppDependencies = {
  userRepository?: UserRepository;
  animaRepository?: AnimaRepository;
  bestiaryAnimaRepository?: BestiaryAnimaRepository;
  adoptionRepository?: AdoptionRepository;
};

export const createApp = (dependencies: AppDependencies = {}) => {
  const env = getEnv();
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  const userRepository = dependencies.userRepository ?? new PrismaUserRepository();
  const animaRepository = dependencies.animaRepository ?? new PrismaAnimaRepository();
  const bestiaryAnimaRepository = dependencies.bestiaryAnimaRepository ?? new PrismaBestiaryAnimaRepository();
  const adoptionRepository = dependencies.adoptionRepository ?? new PrismaAdoptionRepository();

  app.use("/auth", createAuthRouter(userRepository));
  app.use("/animas", createAnimaRouter(animaRepository));
  app.use("/bestiario", createBestiaryAnimaRouter(bestiaryAnimaRepository));
  app.use("/adocoes", createAdoptionRouter(adoptionRepository, animaRepository));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
