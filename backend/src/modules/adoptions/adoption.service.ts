import { AppError } from "../../lib/errors";
import { AdoptAnimaInput, AdoptedAnimaOutput, AdoptionCandidateOutput } from "../../types/adoption";
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
}
