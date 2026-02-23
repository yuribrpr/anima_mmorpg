import { AppError } from "../../lib/errors";
import { prisma } from "../../config/prisma";
import { CreateAnimaInput, UpdateAnimaInput } from "../../types/anima";
import { AnimaRepository } from "./anima.repository";

export class AnimaService {
  constructor(private readonly animaRepository: AnimaRepository) {}

  async list() {
    return this.animaRepository.list();
  }

  async create(input: CreateAnimaInput) {
    const data = await this.prepareCreateOrUpdateData(input, null);
    const created = await this.animaRepository.create(data);
    await this.syncPreviousEvolutionLink(created.id, input.previousEvolutionId ?? null);
    const refreshed = await this.animaRepository.findById(created.id);
    return refreshed ?? created;
  }

  async update(id: string, input: UpdateAnimaInput) {
    const existing = await this.animaRepository.findById(id);

    if (!existing) {
      throw new AppError(404, "ANIMA_NOT_FOUND", "Anima not found");
    }

    const data = await this.prepareCreateOrUpdateData(input, id);
    const updated = await this.animaRepository.update(id, data);
    await this.syncPreviousEvolutionLink(id, input.previousEvolutionId ?? null);
    const refreshed = await this.animaRepository.findById(id);
    return refreshed ?? updated;
  }

  async delete(id: string) {
    const existing = await this.animaRepository.findById(id);

    if (!existing) {
      throw new AppError(404, "ANIMA_NOT_FOUND", "Anima not found");
    }

    await this.animaRepository.delete(id);
  }

  private async prepareCreateOrUpdateData(input: CreateAnimaInput, currentAnimaId: string | null) {
    if (currentAnimaId && input.nextEvolutionId && input.nextEvolutionId === currentAnimaId) {
      throw new AppError(400, "INVALID_NEXT_EVOLUTION", "Anima cannot evolve to itself");
    }
    if (currentAnimaId && input.previousEvolutionId && input.previousEvolutionId === currentAnimaId) {
      throw new AppError(400, "INVALID_PREVIOUS_EVOLUTION", "Anima cannot be previous evolution of itself");
    }
    if (input.previousEvolutionId && input.nextEvolutionId && input.previousEvolutionId === input.nextEvolutionId) {
      throw new AppError(400, "INVALID_EVOLUTION_CHAIN", "Previous and next evolution cannot be the same anima");
    }

    if (input.nextEvolutionId) {
      const nextEvolution = await this.animaRepository.findById(input.nextEvolutionId);
      if (!nextEvolution) {
        throw new AppError(400, "NEXT_EVOLUTION_NOT_FOUND", "Next evolution anima not found");
      }
    }
    if (input.previousEvolutionId) {
      const previousEvolution = await this.animaRepository.findById(input.previousEvolutionId);
      if (!previousEvolution) {
        throw new AppError(400, "PREVIOUS_EVOLUTION_NOT_FOUND", "Previous evolution anima not found");
      }
    }

    return {
      name: input.name,
      attack: input.attack,
      attackSpeedSeconds: input.attackSpeedSeconds,
      critChance: input.critChance,
      agility: input.agility,
      defense: input.defense,
      maxHp: input.maxHp,
      imageData: input.imageData ?? null,
      spriteScale: input.spriteScale ?? 3,
      flipHorizontal: input.flipHorizontal ?? true,
      powerLevel: input.powerLevel,
      nextEvolutionId: input.nextEvolutionId ?? null,
      nextEvolutionLevelRequired: Math.max(1, Math.floor(input.nextEvolutionLevelRequired ?? 10)),
    };
  }

  private async syncPreviousEvolutionLink(animaId: string, previousEvolutionId: string | null) {
    await prisma.$transaction(async (tx) => {
      await tx.anima.updateMany({
        where: {
          nextEvolutionId: animaId,
          id: previousEvolutionId ? { not: previousEvolutionId } : undefined,
        },
        data: {
          nextEvolutionId: null,
        },
      });

      if (previousEvolutionId) {
        await tx.anima.update({
          where: { id: previousEvolutionId },
          data: { nextEvolutionId: animaId },
        });
      }
    });
  }
}
