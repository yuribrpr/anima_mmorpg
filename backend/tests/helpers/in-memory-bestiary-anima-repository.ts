import { BestiaryAnima, PowerLevel } from "@prisma/client";
import { BestiaryAnimaRepository, CreateBestiaryAnimaData, UpdateBestiaryAnimaData } from "../../src/modules/bestiary/bestiary.repository";

export class InMemoryBestiaryAnimaRepository implements BestiaryAnimaRepository {
  private animas = new Map<string, BestiaryAnima>();

  async list() {
    return [...this.animas.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string) {
    return this.animas.get(id) ?? null;
  }

  async create(data: CreateBestiaryAnimaData) {
    const now = new Date();
    const anima: BestiaryAnima = {
      id: `enemy_${this.animas.size + 1}`,
      name: data.name,
      attack: data.attack,
      attackSpeedSeconds: data.attackSpeedSeconds,
      critChance: data.critChance,
      agility: data.agility,
      defense: data.defense,
      maxHp: data.maxHp,
      imageData: data.imageData,
      powerLevel: data.powerLevel as PowerLevel,
      bitsDrop: data.bitsDrop,
      xpDrop: data.xpDrop,
      createdAt: now,
      updatedAt: now,
    };

    this.animas.set(anima.id, anima);
    return anima;
  }

  async update(id: string, data: UpdateBestiaryAnimaData) {
    const existing = this.animas.get(id);
    if (!existing) {
      throw new Error("Bestiary anima not found");
    }

    const updated: BestiaryAnima = {
      ...existing,
      name: data.name,
      attack: data.attack,
      attackSpeedSeconds: data.attackSpeedSeconds,
      critChance: data.critChance,
      agility: data.agility,
      defense: data.defense,
      maxHp: data.maxHp,
      imageData: data.imageData,
      powerLevel: data.powerLevel as PowerLevel,
      bitsDrop: data.bitsDrop,
      xpDrop: data.xpDrop,
      updatedAt: new Date(),
    };

    this.animas.set(id, updated);
    return updated;
  }
}
