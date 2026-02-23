import { Anima, PowerLevel } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type AnimaWithNextEvolution = Anima & {
  nextEvolution: Pick<Anima, "id" | "name" | "imageData"> | null;
  previousEvolutionId: string | null;
  previousEvolution: Pick<Anima, "id" | "name" | "imageData"> | null;
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
  spriteScale: number;
  flipHorizontal: boolean;
  powerLevel: PowerLevel;
  nextEvolutionId: string | null;
  nextEvolutionLevelRequired: number;
};

export interface AnimaRepository {
  list(): Promise<AnimaWithNextEvolution[]>;
  findById(id: string): Promise<AnimaWithNextEvolution | null>;
  create(data: CreateAnimaData): Promise<AnimaWithNextEvolution>;
  update(id: string, data: CreateAnimaData): Promise<AnimaWithNextEvolution>;
  delete(id: string): Promise<void>;
}

const withEvolutionArgs = {
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
} as const;

const toAnimaWithEvolution = (
  entity: Anima & {
    nextEvolution: Pick<Anima, "id" | "name" | "imageData"> | null;
    previousEvolutions: Array<Pick<Anima, "id" | "name" | "imageData">>;
  },
): AnimaWithNextEvolution => ({
  ...entity,
  previousEvolutionId: entity.previousEvolutions[0]?.id ?? null,
  previousEvolution: entity.previousEvolutions[0] ?? null,
});

export class PrismaAnimaRepository implements AnimaRepository {
  async list() {
    const items = await prisma.anima.findMany({
      ...withEvolutionArgs,
      orderBy: {
        createdAt: "desc",
      },
    });
    return items.map(toAnimaWithEvolution);
  }

  async findById(id: string) {
    const item = await prisma.anima.findUnique({
      where: { id },
      ...withEvolutionArgs,
    });
    return item ? toAnimaWithEvolution(item) : null;
  }

  async create(data: CreateAnimaData) {
    const item = await prisma.anima.create({
      data,
      ...withEvolutionArgs,
    });
    return toAnimaWithEvolution(item);
  }

  async update(id: string, data: CreateAnimaData) {
    const item = await prisma.anima.update({
      where: { id },
      data,
      ...withEvolutionArgs,
    });
    return toAnimaWithEvolution(item);
  }

  async delete(id: string) {
    await prisma.anima.delete({
      where: { id },
    });
  }
}
