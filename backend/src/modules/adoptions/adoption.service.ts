import { AppError } from "../../lib/errors";
import { AdoptAnimaInput, AdoptedAnimaOutput, AdoptionCandidateOutput, AdoptionEvolutionChainOutput, EvolutionChainNodeOutput } from "../../types/adoption";
import { AnimaRepository, AnimaWithNextEvolution } from "../animas/anima.repository";
import { AdoptionRepository, AdoptedAnimaWithBase } from "./adoption.repository";

const STARTER_EXPERIENCE_MAX = 1000;

const toCandidateOutput = (anima: AnimaWithNextEvolution): AdoptionCandidateOutput => ({
  id: anima.id,
  name: anima.name,
  imageData: anima.imageData,
  spriteScale: anima.spriteScale,
  flipHorizontal: anima.flipHorizontal,
  powerLevel: anima.powerLevel,
  attack: anima.attack,
  attackSpeedSeconds: anima.attackSpeedSeconds,
  critChance: anima.critChance,
  agility: anima.agility,
  defense: anima.defense,
  maxHp: anima.maxHp,
  nextEvolutionLevelRequired: anima.nextEvolutionLevelRequired,
  nextEvolution: anima.nextEvolution
    ? {
        id: anima.nextEvolution.id,
        name: anima.nextEvolution.name,
        imageData: anima.nextEvolution.imageData,
      }
    : null,
  previousEvolution: null,
});

const toAdoptedOutput = (item: AdoptedAnimaWithBase): AdoptedAnimaOutput => {
  const totalAttack = item.baseAnima.attack + item.bonusAttack;
  const totalDefense = item.baseAnima.defense + item.bonusDefense;
  const totalMaxHp = item.baseAnima.maxHp + item.bonusMaxHp;
  const totalAttackSpeedSeconds = Math.max(0.1, Number((item.baseAnima.attackSpeedSeconds - item.attackSpeedReduction).toFixed(2)));
  const totalCritChance = Number((item.baseAnima.critChance + item.critChanceBonus).toFixed(2));

  return {
    id: item.id,
    nickname: item.nickname,
    isPrimary: item.isPrimary,
    level: item.level,
    experience: item.experience,
    experienceMax: item.experienceMax,
    currentHp: Math.min(item.currentHp, totalMaxHp),
    bonusAttack: item.bonusAttack,
    bonusDefense: item.bonusDefense,
    bonusMaxHp: item.bonusMaxHp,
    attackSpeedReduction: item.attackSpeedReduction,
    critChanceBonus: item.critChanceBonus,
    isNextEvolutionUnlocked: item.isNextEvolutionUnlocked,
    totalAttack,
    totalDefense,
    totalMaxHp,
    totalAttackSpeedSeconds,
    totalCritChance,
    baseAnima: {
      id: item.baseAnima.id,
      name: item.baseAnima.name,
      imageData: item.baseAnima.imageData,
      spriteScale: item.baseAnima.spriteScale,
      flipHorizontal: item.baseAnima.flipHorizontal,
      powerLevel: item.baseAnima.powerLevel,
      attack: item.baseAnima.attack,
      attackSpeedSeconds: item.baseAnima.attackSpeedSeconds,
      critChance: item.baseAnima.critChance,
      agility: item.baseAnima.agility,
      defense: item.baseAnima.defense,
      maxHp: item.baseAnima.maxHp,
      nextEvolutionLevelRequired: item.baseAnima.nextEvolutionLevelRequired,
      nextEvolution: item.baseAnima.nextEvolution
        ? {
            id: item.baseAnima.nextEvolution.id,
            name: item.baseAnima.nextEvolution.name,
            imageData: item.baseAnima.nextEvolution.imageData,
          }
        : null,
      previousEvolution:
        item.baseAnima.previousEvolutions[0]
          ? {
              id: item.baseAnima.previousEvolutions[0].id,
              name: item.baseAnima.previousEvolutions[0].name,
              imageData: item.baseAnima.previousEvolutions[0].imageData,
            }
          : null,
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

export class AdoptionService {
  constructor(
    private readonly adoptionRepository: AdoptionRepository,
    private readonly animaRepository: AnimaRepository,
  ) {}

  async listCandidates() {
    const animas = await this.animaRepository.list();
    return animas.filter((anima) => anima.powerLevel === "ROOKIE").map(toCandidateOutput);
  }

  async adopt(userId: string, input: AdoptAnimaInput) {
    const baseAnima = await this.animaRepository.findById(input.animaId);

    if (!baseAnima || baseAnima.powerLevel !== "ROOKIE") {
      throw new AppError(400, "ANIMA_NOT_AVAILABLE_FOR_ADOPTION", "Only rookie animas can be adopted");
    }

    const existingByUser = await this.adoptionRepository.listByUserId(userId);
    const hasPrimary = existingByUser.some((item) => item.isPrimary);
    const bonusAttack = Math.max(1, Math.round(baseAnima.attack * 0.08));
    const bonusDefense = Math.max(1, Math.round(baseAnima.defense * 0.08));
    const bonusMaxHp = Math.max(10, Math.round(baseAnima.maxHp * 0.12));
    const attackSpeedReduction = Number((baseAnima.attackSpeedSeconds * 0.04).toFixed(2));
    const critChanceBonus = 2;
    const totalMaxHp = baseAnima.maxHp + bonusMaxHp;

    const adopted = await this.adoptionRepository.create({
      userId,
      baseAnimaId: baseAnima.id,
      nickname: input.nickname.trim(),
      level: 1,
      experience: 0,
      experienceMax: STARTER_EXPERIENCE_MAX,
      currentHp: totalMaxHp,
      bonusAttack,
      bonusDefense,
      bonusMaxHp,
      attackSpeedReduction,
      critChanceBonus,
      isPrimary: !hasPrimary,
      isNextEvolutionUnlocked: false,
    });

    return toAdoptedOutput(adopted);
  }

  async listInventory(userId: string) {
    const items = await this.adoptionRepository.listByUserId(userId);
    return items.map(toAdoptedOutput);
  }

  async setPrimary(userId: string, adoptedAnimaId: string) {
    const existing = await this.adoptionRepository.findByIdForUser(adoptedAnimaId, userId);

    if (!existing) {
      throw new AppError(404, "ADOPTED_ANIMA_NOT_FOUND", "Adopted anima not found");
    }

    await this.adoptionRepository.clearPrimaryByUserId(userId);
    const updated = await this.adoptionRepository.setPrimary(adoptedAnimaId);

    return toAdoptedOutput(updated);
  }

  async unlockNextEvolution(userId: string, adoptedAnimaId: string) {
    const existing = await this.adoptionRepository.findByIdForUser(adoptedAnimaId, userId);
    if (!existing) {
      throw new AppError(404, "ADOPTED_ANIMA_NOT_FOUND", "Adopted anima not found");
    }

    const nextEvolution = existing.baseAnima.nextEvolution;
    if (!nextEvolution) {
      throw new AppError(400, "ANIMA_HAS_NO_NEXT_EVOLUTION", "This anima has no next evolution");
    }
    if (existing.isNextEvolutionUnlocked) {
      return toAdoptedOutput(existing);
    }
    if (existing.level < existing.baseAnima.nextEvolutionLevelRequired) {
      throw new AppError(400, "ANIMA_LEVEL_TOO_LOW_FOR_EVOLUTION", "Level is too low to unlock next evolution");
    }

    const updated = await this.adoptionRepository.unlockNextEvolution(existing.id);
    return toAdoptedOutput(updated);
  }

  async evolveToNext(userId: string, adoptedAnimaId: string) {
    const existing = await this.adoptionRepository.findByIdForUser(adoptedAnimaId, userId);
    if (!existing) {
      throw new AppError(404, "ADOPTED_ANIMA_NOT_FOUND", "Adopted anima not found");
    }

    const nextEvolution = existing.baseAnima.nextEvolution;
    if (!nextEvolution) {
      throw new AppError(400, "ANIMA_HAS_NO_NEXT_EVOLUTION", "This anima has no next evolution");
    }
    if (existing.level < existing.baseAnima.nextEvolutionLevelRequired) {
      throw new AppError(400, "ANIMA_LEVEL_TOO_LOW_FOR_EVOLUTION", "Level is too low to evolve to next evolution");
    }
    const nextEvolutionFull = await this.animaRepository.findById(nextEvolution.id);
    if (!nextEvolutionFull) {
      throw new AppError(404, "NEXT_EVOLUTION_NOT_FOUND", "Next evolution anima not found");
    }

    const currentTotalMaxHp = Math.max(1, existing.baseAnima.maxHp + existing.bonusMaxHp);
    const hpRatio = Math.max(0, Math.min(1, existing.currentHp / currentTotalMaxHp));
    const nextTotalMaxHp = Math.max(1, nextEvolutionFull.maxHp + existing.bonusMaxHp);
    const nextCurrentHp = Math.max(1, Math.round(nextTotalMaxHp * hpRatio));

    const updated = await this.adoptionRepository.evolveToNext(existing.id, nextEvolution.id, nextCurrentHp);
    return toAdoptedOutput(updated);
  }

  async regressToPrevious(userId: string, adoptedAnimaId: string) {
    const existing = await this.adoptionRepository.findByIdForUser(adoptedAnimaId, userId);
    if (!existing) {
      throw new AppError(404, "ADOPTED_ANIMA_NOT_FOUND", "Adopted anima not found");
    }

    const previousEvolution = existing.baseAnima.previousEvolutions[0] ?? null;
    if (!previousEvolution) {
      throw new AppError(400, "ANIMA_HAS_NO_PREVIOUS_EVOLUTION", "This anima has no previous evolution");
    }

    const previousEvolutionFull = await this.animaRepository.findById(previousEvolution.id);
    if (!previousEvolutionFull) {
      throw new AppError(404, "PREVIOUS_EVOLUTION_NOT_FOUND", "Previous evolution anima not found");
    }

    const currentTotalMaxHp = Math.max(1, existing.baseAnima.maxHp + existing.bonusMaxHp);
    const hpRatio = Math.max(0, Math.min(1, existing.currentHp / currentTotalMaxHp));
    const nextTotalMaxHp = Math.max(1, previousEvolutionFull.maxHp + existing.bonusMaxHp);
    const nextCurrentHp = Math.max(1, Math.round(nextTotalMaxHp * hpRatio));

    const updated = await this.adoptionRepository.regressToPrevious(existing.id, previousEvolution.id, nextCurrentHp);
    return toAdoptedOutput(updated);
  }

  async getEvolutionChain(userId: string, adoptedAnimaId: string): Promise<AdoptionEvolutionChainOutput> {
    const existing = await this.adoptionRepository.findByIdForUser(adoptedAnimaId, userId);
    if (!existing) {
      throw new AppError(404, "ADOPTED_ANIMA_NOT_FOUND", "Adopted anima not found");
    }

    const currentBase = await this.animaRepository.findById(existing.baseAnima.id);
    if (!currentBase) {
      throw new AppError(404, "ANIMA_NOT_FOUND", "Anima not found");
    }

    const chain: EvolutionChainNodeOutput[] = [
      {
        id: currentBase.id,
        name: currentBase.name,
        imageData: currentBase.imageData,
        levelRequiredFromPrevious: null,
      },
    ];
    const visited = new Set<string>([currentBase.id]);

    let cursor = currentBase;
    while (cursor.previousEvolutionId && !visited.has(cursor.previousEvolutionId)) {
      const previous = await this.animaRepository.findById(cursor.previousEvolutionId);
      if (!previous) break;
      chain.unshift({
        id: previous.id,
        name: previous.name,
        imageData: previous.imageData,
        levelRequiredFromPrevious: null,
      });
      visited.add(previous.id);
      cursor = previous;
      if (chain.length >= 12) break;
    }

    cursor = currentBase;
    while (cursor.nextEvolutionId && !visited.has(cursor.nextEvolutionId)) {
      const next = await this.animaRepository.findById(cursor.nextEvolutionId);
      if (!next) break;
      chain.push({
        id: next.id,
        name: next.name,
        imageData: next.imageData,
        levelRequiredFromPrevious: cursor.nextEvolutionLevelRequired,
      });
      visited.add(next.id);
      cursor = next;
      if (chain.length >= 12) break;
    }

    for (let index = 1; index < chain.length; index += 1) {
      const previousNode = chain[index - 1];
      const currentNode = chain[index];
      if (!previousNode || !currentNode) continue;
      const previousFull = await this.animaRepository.findById(previousNode.id);
      currentNode.levelRequiredFromPrevious = previousFull?.nextEvolutionLevelRequired ?? currentNode.levelRequiredFromPrevious ?? null;
    }

    const currentIndex = chain.findIndex((node) => node.id === currentBase.id);

    return {
      adoptedAnimaId: existing.id,
      currentBaseAnimaId: currentBase.id,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      chain,
    };
  }
}
