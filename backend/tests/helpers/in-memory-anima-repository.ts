import { PowerLevel } from "@prisma/client";
import { AnimaRepository, AnimaWithNextEvolution, CreateAnimaData } from "../../src/modules/animas/anima.repository";

export class InMemoryAnimaRepository implements AnimaRepository {
  private animas = new Map<string, AnimaWithNextEvolution>();

  async list() {
    return [...this.animas.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string) {
    return this.animas.get(id) ?? null;
  }

  async create(data: CreateAnimaData) {
    const now = new Date();
    const id = `anima_${this.animas.size + 1}`;

    const nextEvolution = data.nextEvolutionId
      ? this.animas.get(data.nextEvolutionId)
      : null;

    const anima: AnimaWithNextEvolution = {
      id,
      name: data.name,
      attack: data.attack,
      attackSpeedSeconds: data.attackSpeedSeconds,
      critChance: data.critChance,
      agility: data.agility,
      defense: data.defense,
      maxHp: data.maxHp,
      imageData: data.imageData,
      powerLevel: data.powerLevel as PowerLevel,
      nextEvolutionId: data.nextEvolutionId,
      nextEvolution: nextEvolution
        ? {
            id: nextEvolution.id,
            name: nextEvolution.name,
            imageData: nextEvolution.imageData,
          }
        : null,
      createdAt: now,
      updatedAt: now,
    };

    this.animas.set(anima.id, anima);
    return anima;
  }

  async update(id: string, data: CreateAnimaData) {
    const existing = this.animas.get(id);
    if (!existing) {
      throw new Error("Anima not found");
    }

    const nextEvolution = data.nextEvolutionId
      ? this.animas.get(data.nextEvolutionId)
      : null;

    const updated: AnimaWithNextEvolution = {
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
      nextEvolutionId: data.nextEvolutionId,
      nextEvolution: nextEvolution
        ? {
            id: nextEvolution.id,
            name: nextEvolution.name,
            imageData: nextEvolution.imageData,
          }
        : null,
      updatedAt: new Date(),
    };

    this.animas.set(id, updated);
    return updated;
  }

  async delete(id: string) {
    this.animas.delete(id);

    for (const anima of this.animas.values()) {
      if (anima.nextEvolutionId === id) {
        anima.nextEvolutionId = null;
        anima.nextEvolution = null;
        anima.updatedAt = new Date();
      }
    }
  }
}
