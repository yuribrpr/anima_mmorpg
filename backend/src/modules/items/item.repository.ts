import { Item, ItemType } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateItemData = {
  name: string;
  description: string;
  type: ItemType;
  imageData: string | null;
  stackSize: number;
  healPercentMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusMaxHp: number;
};

export type UpdateItemData = CreateItemData;

export interface ItemRepository {
  list(): Promise<Item[]>;
  findById(id: string): Promise<Item | null>;
  create(data: CreateItemData): Promise<Item>;
  update(id: string, data: UpdateItemData): Promise<Item>;
  delete(id: string): Promise<void>;
}

export class PrismaItemRepository implements ItemRepository {
  async list() {
    return prisma.item.findMany({
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async findById(id: string) {
    return prisma.item.findUnique({
      where: { id },
    });
  }

  async create(data: CreateItemData) {
    return prisma.item.create({
      data,
    });
  }

  async update(id: string, data: UpdateItemData) {
    return prisma.item.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await prisma.item.delete({
      where: { id },
    });
  }
}
