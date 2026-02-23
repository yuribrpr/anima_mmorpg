import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors";
import type { CreateItemInput, ItemOutput, UpdateItemInput } from "../../types/item";
import { DEFAULT_ITEM_IMAGE_GALLERY } from "./item.constants";
import type { ItemRepository } from "./item.repository";

const toOutput = (item: {
  id: string;
  name: string;
  description: string;
  type: "CONSUMIVEL" | "QUEST" | "NORMAL";
  imageData: string | null;
  stackSize: number;
  healPercentMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusMaxHp: number;
  createdAt: Date;
  updatedAt: Date;
}): ItemOutput => ({
  id: item.id,
  name: item.name,
  description: item.description,
  type: item.type,
  imageData: item.imageData,
  stackSize: item.stackSize,
  healPercentMaxHp: item.healPercentMaxHp,
  bonusAttack: item.bonusAttack,
  bonusDefense: item.bonusDefense,
  bonusMaxHp: item.bonusMaxHp,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export class ItemService {
  constructor(private readonly itemRepository: ItemRepository) {}

  private normalizeInput(input: CreateItemInput) {
    const isConsumable = input.type === "CONSUMIVEL";
    return {
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      imageData: input.imageData ?? null,
      stackSize: Math.max(1, input.stackSize ?? 99),
      healPercentMaxHp: isConsumable ? Math.max(0, input.healPercentMaxHp ?? 0) : 0,
      bonusAttack: isConsumable ? Math.max(0, Math.floor(input.bonusAttack ?? 0)) : 0,
      bonusDefense: isConsumable ? Math.max(0, Math.floor(input.bonusDefense ?? 0)) : 0,
      bonusMaxHp: isConsumable ? Math.max(0, Math.floor(input.bonusMaxHp ?? 0)) : 0,
    };
  }

  async list() {
    const items = await this.itemRepository.list();
    return items.map(toOutput);
  }

  async create(input: CreateItemInput) {
    const created = await this.itemRepository.create(this.normalizeInput(input));
    return toOutput(created);
  }

  async update(id: string, input: UpdateItemInput) {
    const existing = await this.itemRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item not found");
    }

    const updated = await this.itemRepository.update(id, this.normalizeInput(input));
    return toOutput(updated);
  }

  async delete(id: string) {
    const existing = await this.itemRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "ITEM_NOT_FOUND", "Item not found");
    }

    try {
      await this.itemRepository.delete(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2003" || error.code === "P2014")
      ) {
        throw new AppError(409, "ITEM_IN_USE", "Item is in use by drops or inventories");
      }
      throw error;
    }
  }

  getGallery() {
    return DEFAULT_ITEM_IMAGE_GALLERY;
  }
}
