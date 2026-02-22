import { Anima, PowerLevel } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type AnimaWithNextEvolution = Anima & {
  nextEvolution: Pick<Anima, "id" | "name" | "imageData"> | null;
};

export type CreateAnimaData = {
  name: string;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
  imageData: string | null;
  powerLevel: PowerLevel;
  nextEvolutionId: string | null;
};

export interface AnimaRepository {
  list(): Promise<AnimaWithNextEvolution[]>;
  findById(id: string): Promise<AnimaWithNextEvolution | null>;
  create(data: CreateAnimaData): Promise<AnimaWithNextEvolution>;
  update(id: string, data: CreateAnimaData): Promise<AnimaWithNextEvolution>;
  delete(id: string): Promise<void>;
}

export class PrismaAnimaRepository implements AnimaRepository {
  async list() {
    return prisma.anima.findMany({
      include: {
        nextEvolution: {
          select: {
            id: true,
            name: true,
            imageData: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: string) {
    return prisma.anima.findUnique({
      where: { id },
      include: {
        nextEvolution: {
          select: {
            id: true,
            name: true,
            imageData: true,
          },
        },
      },
    });
  }

  async create(data: CreateAnimaData) {
    return prisma.anima.create({
      data,
      include: {
        nextEvolution: {
          select: {
            id: true,
            name: true,
            imageData: true,
          },
        },
      },
    });
  }

  async update(id: string, data: CreateAnimaData) {
    return prisma.anima.update({
      where: { id },
      data,
      include: {
        nextEvolution: {
          select: {
            id: true,
            name: true,
            imageData: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    await prisma.anima.delete({
      where: { id },
    });
  }
}
