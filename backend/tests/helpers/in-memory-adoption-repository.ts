import { Anima, AdoptedAnima } from "@prisma/client";
import { AnimaRepository } from "../../src/modules/animas/anima.repository";
import { AdoptionRepository, AdoptedAnimaWithBase, CreateAdoptedAnimaData } from "../../src/modules/adoptions/adoption.repository";

const toBaseAnima = (anima: Awaited<ReturnType<AnimaRepository["findById"]>>): Anima => {
  if (!anima) {
    throw new Error("Base anima not found");
  }

  return {
    id: anima.id,
    name: anima.name,
    attack: anima.attack,
    attackSpeedSeconds: anima.attackSpeedSeconds,
    critChance: anima.critChance,
    agility: anima.agility,
    defense: anima.defense,
    maxHp: anima.maxHp,
    imageData: anima.imageData,
    powerLevel: anima.powerLevel,
    nextEvolutionId: anima.nextEvolutionId,
    createdAt: anima.createdAt,
    updatedAt: anima.updatedAt,
  };
};

export class InMemoryAdoptionRepository implements AdoptionRepository {
  private adopted = new Map<string, AdoptedAnima>();

  constructor(private readonly animaRepository: AnimaRepository) {}

  private async withBase(item: AdoptedAnima): Promise<AdoptedAnimaWithBase> {
    const base = await this.animaRepository.findById(item.baseAnimaId);

    return {
      ...item,
      baseAnima: toBaseAnima(base),
    };
  }

  async listByUserId(userId: string) {
    const userItems = [...this.adopted.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return Promise.all(userItems.map((item) => this.withBase(item)));
  }

  async findByIdForUser(id: string, userId: string) {
    const item = this.adopted.get(id);
    if (!item || item.userId !== userId) {
      return null;
    }

    return this.withBase(item);
  }

  async create(data: CreateAdoptedAnimaData) {
    const now = new Date();
    const adopted: AdoptedAnima = {
      id: `adopted_${this.adopted.size + 1}`,
      userId: data.userId,
      baseAnimaId: data.baseAnimaId,
      nickname: data.nickname,
      level: data.level,
      experience: data.experience,
      experienceMax: data.experienceMax,
      currentHp: data.currentHp,
      bonusAttack: data.bonusAttack,
      bonusDefense: data.bonusDefense,
      bonusMaxHp: data.bonusMaxHp,
      attackSpeedReduction: data.attackSpeedReduction,
      critChanceBonus: data.critChanceBonus,
      isPrimary: data.isPrimary,
      createdAt: now,
      updatedAt: now,
    };

    this.adopted.set(adopted.id, adopted);
    return this.withBase(adopted);
  }

  async clearPrimaryByUserId(userId: string) {
    for (const item of this.adopted.values()) {
      if (item.userId === userId && item.isPrimary) {
        item.isPrimary = false;
        item.updatedAt = new Date();
      }
    }
  }

  async setPrimary(id: string) {
    const item = this.adopted.get(id);
    if (!item) {
      throw new Error("Adopted anima not found");
    }

    item.isPrimary = true;
    item.updatedAt = new Date();
    return this.withBase(item);
  }
}
