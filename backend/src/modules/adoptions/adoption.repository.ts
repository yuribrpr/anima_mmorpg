import { AdoptedAnima, Anima } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type AdoptedAnimaWithBase = AdoptedAnima & {
  baseAnima: Anima;
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
};

export interface AdoptionRepository {
  listByUserId(userId: string): Promise<AdoptedAnimaWithBase[]>;
  findByIdForUser(id: string, userId: string): Promise<AdoptedAnimaWithBase | null>;
  create(data: CreateAdoptedAnimaData): Promise<AdoptedAnimaWithBase>;
  clearPrimaryByUserId(userId: string): Promise<void>;
  setPrimary(id: string): Promise<AdoptedAnimaWithBase>;
}

const withBaseInclude = {
  include: {
    baseAnima: true,
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
}
