import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import {
  acceptNpcQuestSchema,
  createNpcDefinitionSchema,
  deliverNpcQuestSchema,
  npcBuySchema,
  npcCraftSchema,
  npcParamsSchema,
  registerEnemyDefeatSchema,
  registerNpcTalkSchema,
  updateNpcDefinitionSchema,
} from "./npc.schemas";
import { NpcService } from "./npc.service";

export class NpcController {
  constructor(private readonly npcService: NpcService) {}

  listActiveMap = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const npcs = await this.npcService.listActiveMapNpcs(request.authUserId);
      response.status(200).json({ npcs });
    } catch (error) {
      next(error);
    }
  };

  listPlayerQuests = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const quests = await this.npcService.listPlayerQuests(request.authUserId);
      response.status(200).json(quests);
    } catch (error) {
      next(error);
    }
  };

  acceptQuest = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = acceptNpcQuestSchema.parse(request.body);
      const result = await this.npcService.acceptQuest(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  deliverQuest = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = deliverNpcQuestSchema.parse(request.body);
      const result = await this.npcService.deliverQuest(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  registerTalk = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = registerNpcTalkSchema.parse(request.body);
      const result = await this.npcService.registerTalk(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  registerEnemyDefeat = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = registerEnemyDefeatSchema.parse(request.body);
      const result = await this.npcService.registerEnemyDefeat(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  buy = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = npcBuySchema.parse(request.body);
      const result = await this.npcService.buy(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  craft = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.authUserId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const input = npcCraftSchema.parse(request.body);
      const result = await this.npcService.craft(request.authUserId, input);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  listAdmin = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const npcs = await this.npcService.listAdmin();
      response.status(200).json({ npcs });
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createNpcDefinitionSchema.parse(request.body);
      const npc = await this.npcService.create(input);
      response.status(201).json({ npc });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = npcParamsSchema.parse(request.params);
      const input = updateNpcDefinitionSchema.parse(request.body);
      const npc = await this.npcService.update(params.id, input);
      response.status(200).json({ npc });
    } catch (error) {
      next(error);
    }
  };

  delete = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const params = npcParamsSchema.parse(request.params);
      await this.npcService.delete(params.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
