import { BestiaryAnima, PowerLevel } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateBestiaryAnimaData = {
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
  bitsDrop: number;
  xpDrop: number;
};

export type UpdateBestiaryAnimaData = CreateBestiaryAnimaData;

export interface BestiaryAnimaRepository {
  list(): Promise<BestiaryAnima[]>;
  findById(id: string): Promise<BestiaryAnima | null>;
  create(data: CreateBestiaryAnimaData): Promise<BestiaryAnima>;
  update(id: string, data: UpdateBestiaryAnimaData): Promise<BestiaryAnima>;
}

export class PrismaBestiaryAnimaRepository implements BestiaryAnimaRepository {
  async list() {
    return prisma.bestiaryAnima.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: string) {
    return prisma.bestiaryAnima.findUnique({
      where: { id },
    });
  }

  async create(data: CreateBestiaryAnimaData) {
    return prisma.bestiaryAnima.create({
      data,
    });
  }

  async update(id: string, data: UpdateBestiaryAnimaData) {
    return prisma.bestiaryAnima.update({
      where: { id },
      data,
    });
  }
}
