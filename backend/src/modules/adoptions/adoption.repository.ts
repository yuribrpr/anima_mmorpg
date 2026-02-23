import { AdoptedAnima, Anima } from "@prisma/client";
import { prisma } from "../../config/prisma";

type BaseAnimaWithNextEvolution = Anima & {
  nextEvolution: Pick<Anima, "id" | "name" | "imageData"> | null;
  previousEvolutions: Array<Pick<Anima, "id" | "name" | "imageData">>;
};

export type AdoptedAnimaWithBase = AdoptedAnima & {
  baseAnima: BaseAnimaWithNextEvolution;
};

export type CreateAdoptedAnimaData = {
  userId: string;
  baseAnimaId: string;
  nickname: string;
  level: number;
  experience: number;
  experienceMax: number;
  currentHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusMaxHp: number;
  attackSpeedReduction: number;
  critChanceBonus: number;
  isPrimary: boolean;
  isNextEvolutionUnlocked: boolean;
};

export interface AdoptionRepository {
  listByUserId(userId: string): Promise<AdoptedAnimaWithBase[]>;
  findByIdForUser(id: string, userId: string): Promise<AdoptedAnimaWithBase | null>;
  create(data: CreateAdoptedAnimaData): Promise<AdoptedAnimaWithBase>;
  clearPrimaryByUserId(userId: string): Promise<void>;
  setPrimary(id: string): Promise<AdoptedAnimaWithBase>;
  unlockNextEvolution(id: string): Promise<AdoptedAnimaWithBase>;
  evolveToNext(id: string, nextBaseAnimaId: string, nextCurrentHp: number): Promise<AdoptedAnimaWithBase>;
  regressToPrevious(id: string, previousBaseAnimaId: string, nextCurrentHp: number): Promise<AdoptedAnimaWithBase>;
}

const withBaseInclude = {
  include: {
    baseAnima: {
      include: {
        nextEvolution: {
          select: {
            id: true,
            name: true,
            imageData: true,
          },
        },
        previousEvolutions: {
          select: {
            id: true,
            name: true,
            imageData: true,
          },
          take: 1,
        },
      },
    },
  },
} as const;

export class PrismaAdoptionRepository implements AdoptionRepository {
  async listByUserId(userId: string) {
    return prisma.adoptedAnima.findMany({
      where: { userId },
      ...withBaseInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findByIdForUser(id: string, userId: string) {
    return prisma.adoptedAnima.findFirst({
      where: { id, userId },
      ...withBaseInclude,
    });
  }

  async create(data: CreateAdoptedAnimaData) {
    return prisma.adoptedAnima.create({
      data,
      ...withBaseInclude,
    });
  }

  async clearPrimaryByUserId(userId: string) {
    await prisma.adoptedAnima.updateMany({
      where: {
        userId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  async setPrimary(id: string) {
    return prisma.adoptedAnima.update({
      where: { id },
      data: {
        isPrimary: true,
      },
      ...withBaseInclude,
    });
  }

  async unlockNextEvolution(id: string) {
    return prisma.adoptedAnima.update({
      where: { id },
      data: {
        isNextEvolutionUnlocked: true,
      },
      ...withBaseInclude,
    });
  }

  async evolveToNext(id: string, nextBaseAnimaId: string, nextCurrentHp: number) {
    return prisma.adoptedAnima.update({
      where: { id },
      data: {
        baseAnimaId: nextBaseAnimaId,
        currentHp: nextCurrentHp,
        isNextEvolutionUnlocked: false,
      },
      ...withBaseInclude,
    });
  }

  async regressToPrevious(id: string, previousBaseAnimaId: string, nextCurrentHp: number) {
    return prisma.adoptedAnima.update({
      where: { id },
      data: {
        baseAnimaId: previousBaseAnimaId,
        currentHp: nextCurrentHp,
        isNextEvolutionUnlocked: false,
      },
      ...withBaseInclude,
    });
  }
}
