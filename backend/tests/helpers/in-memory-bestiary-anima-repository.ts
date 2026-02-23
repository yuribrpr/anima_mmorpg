import { BestiaryAnima, PowerLevel } from "@prisma/client";
import {
  BestiaryAnimaEntity,
  BestiaryAnimaRepository,
  CreateBestiaryAnimaData,
  UpdateBestiaryAnimaData,
} from "../../src/modules/bestiary/bestiary.repository";

export class InMemoryBestiaryAnimaRepository implements BestiaryAnimaRepository {
  private animas = new Map<string, BestiaryAnimaEntity>();

  async list() {
    return [...this.animas.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string) {
    return this.animas.get(id) ?? null;
  }

  async create(data: CreateBestiaryAnimaData) {
    const now = new Date();
    const baseAnima: BestiaryAnima = {
      id: `enemy_${this.animas.size + 1}`,
      name: data.name,
      attack: data.attack,
      attackSpeedSeconds: data.attackSpeedSeconds,
      critChance: data.critChance,
      agility: data.agility,
      defense: data.defense,
      maxHp: data.maxHp,
      imageData: data.imageData,
      spriteScale: data.spriteScale,
      flipHorizontal: data.flipHorizontal,
      powerLevel: data.powerLevel as PowerLevel,
      bitsDrop: data.bitsDrop,
      xpDrop: data.xpDrop,
      createdAt: now,
      updatedAt: now,
    };
    const anima: BestiaryAnimaEntity = {
      ...baseAnima,
      drops: data.drops.map((drop, index) => ({
        id: `drop_${baseAnima.id}_${index}`,
        bestiaryAnimaId: baseAnima.id,
        itemId: drop.itemId,
        quantity: drop.quantity,
        dropChance: drop.dropChance,
        createdAt: now,
        updatedAt: now,
        item: {
          id: drop.itemId,
          name: `Item ${drop.itemId}`,
          type: "NORMAL",
          imageData: null,
          stackSize: 99,
          healPercentMaxHp: 0,
          bonusAttack: 0,
          bonusDefense: 0,
          bonusMaxHp: 0,
        },
      })),
    };

    this.animas.set(anima.id, anima);
    return anima;
  }

  async update(id: string, data: UpdateBestiaryAnimaData) {
    const existing = this.animas.get(id);
    if (!existing) {
      throw new Error("Bestiary anima not found");
    }

    const updated: BestiaryAnimaEntity = {
      ...existing,
      name: data.name,
      attack: data.attack,
      attackSpeedSeconds: data.attackSpeedSeconds,
      critChance: data.critChance,
      agility: data.agility,
      defense: data.defense,
      maxHp: data.maxHp,
      imageData: data.imageData,
      spriteScale: data.spriteScale,
      flipHorizontal: data.flipHorizontal,
      powerLevel: data.powerLevel as PowerLevel,
      bitsDrop: data.bitsDrop,
      xpDrop: data.xpDrop,
      updatedAt: new Date(),
      drops: data.drops.map((drop, index) => ({
        id: `drop_${id}_${index}`,
        bestiaryAnimaId: id,
        itemId: drop.itemId,
        quantity: drop.quantity,
        dropChance: drop.dropChance,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
        item: {
          id: drop.itemId,
          name: `Item ${drop.itemId}`,
          type: "NORMAL",
          imageData: null,
          stackSize: 99,
          healPercentMaxHp: 0,
          bonusAttack: 0,
          bonusDefense: 0,
          bonusMaxHp: 0,
        },
      })),
    };

    this.animas.set(id, updated);
    return updated;
  }
}
