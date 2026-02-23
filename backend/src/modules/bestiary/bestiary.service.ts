import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { CreateBestiaryAnimaInput, UpdateBestiaryAnimaInput } from "../../types/bestiary-anima";
import { BestiaryAnimaRepository } from "./bestiary.repository";

export class BestiaryAnimaService {
  constructor(private readonly bestiaryAnimaRepository: BestiaryAnimaRepository) {}

  async list() {
    return this.bestiaryAnimaRepository.list();
  }

  async create(input: CreateBestiaryAnimaInput) {
    try {
      const data = this.prepareCreateOrUpdateData(input);
      return this.bestiaryAnimaRepository.create(data);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new AppError(400, "BESTIARY_DROP_ITEM_NOT_FOUND", "One or more drop items are invalid");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateBestiaryAnimaInput) {
    const existing = await this.bestiaryAnimaRepository.findById(id);

    if (!existing) {
      throw new AppError(404, "BESTIARY_ANIMA_NOT_FOUND", "Bestiary anima not found");
    }

    try {
      const data = this.prepareCreateOrUpdateData(input);
      return this.bestiaryAnimaRepository.update(id, data);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new AppError(400, "BESTIARY_DROP_ITEM_NOT_FOUND", "One or more drop items are invalid");
      }
      throw error;
    }
  }

  async delete(id: string) {
    const existing = await this.bestiaryAnimaRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "BESTIARY_ANIMA_NOT_FOUND", "Bestiary anima not found");
    }

    await this.bestiaryAnimaRepository.delete(id);
  }

  private prepareCreateOrUpdateData(input: CreateBestiaryAnimaInput) {
    const totalPower = input.attack + input.defense;
    const bitsDrop = Math.round(totalPower * 0.1);
    const xpDrop = Math.round(totalPower * 0.15);

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
      flipHorizontal: input.flipHorizontal ?? false,
      powerLevel: input.powerLevel,
      bitsDrop,
      xpDrop,
      drops: (input.drops ?? []).map((drop) => ({
        itemId: drop.itemId,
        quantity: Math.max(1, Math.floor(drop.quantity)),
        dropChance: Math.max(0, Number(drop.dropChance)),
      })),
    };
  }
}
