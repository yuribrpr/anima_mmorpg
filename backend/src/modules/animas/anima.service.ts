import { Prisma } from "@prisma/client";
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

    try {
      await prisma.$transaction(async (tx) => {
        const adoptedUsingAnima = await tx.adoptedAnima.findMany({
          where: { baseAnimaId: id },
          select: {
            userId: true,
            isPrimary: true,
          },
        });

        if (adoptedUsingAnima.length > 0) {
          await tx.adoptedAnima.deleteMany({
            where: { baseAnimaId: id },
          });

          const usersWithDeletedPrimary = [...new Set(adoptedUsingAnima.filter((entry) => entry.isPrimary).map((entry) => entry.userId))];

          for (const userId of usersWithDeletedPrimary) {
            const hasPrimary = await tx.adoptedAnima.findFirst({
              where: { userId, isPrimary: true },
              select: { id: true },
            });
            if (hasPrimary) {
              continue;
            }

            const fallback = await tx.adoptedAnima.findFirst({
              where: { userId },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            });
            if (!fallback) {
              continue;
            }

            await tx.adoptedAnima.update({
              where: { id: fallback.id },
              data: { isPrimary: true },
            });
          }
        }
      });

      await this.animaRepository.delete(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(404, "ANIMA_NOT_FOUND", "Anima not found");
        }
        if (error.code === "P2003" || error.code === "P2014") {
          throw new AppError(409, "ANIMA_IN_USE", "Anima is in use and cannot be deleted", {
            prismaCode: error.code,
            constraint: error.meta?.constraint,
          });
        }
      }
      throw error;
    }
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
