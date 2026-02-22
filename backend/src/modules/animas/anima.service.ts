import { AppError } from "../../lib/errors";
import { CreateAnimaInput, UpdateAnimaInput } from "../../types/anima";
import { AnimaRepository } from "./anima.repository";

export class AnimaService {
  constructor(private readonly animaRepository: AnimaRepository) {}

  async list() {
    return this.animaRepository.list();
  }

  async create(input: CreateAnimaInput) {
    const data = await this.prepareCreateOrUpdateData(input);
    return this.animaRepository.create(data);
  }

  async update(id: string, input: UpdateAnimaInput) {
    const existing = await this.animaRepository.findById(id);

    if (!existing) {
      throw new AppError(404, "ANIMA_NOT_FOUND", "Anima not found");
    }

    if (input.nextEvolutionId && input.nextEvolutionId === id) {
      throw new AppError(400, "INVALID_NEXT_EVOLUTION", "Anima cannot evolve to itself");
    }

    const data = await this.prepareCreateOrUpdateData(input);
    return this.animaRepository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.animaRepository.findById(id);

    if (!existing) {
      throw new AppError(404, "ANIMA_NOT_FOUND", "Anima not found");
    }

    await this.animaRepository.delete(id);
  }

  private async prepareCreateOrUpdateData(input: CreateAnimaInput) {
    if (input.nextEvolutionId) {
      const nextEvolution = await this.animaRepository.findById(input.nextEvolutionId);
      if (!nextEvolution) {
        throw new AppError(400, "NEXT_EVOLUTION_NOT_FOUND", "Next evolution anima not found");
      }
    }

    return {
      name: input.name,
      attack: input.attack,
      attackSpeedSeconds: input.attackSpeedSeconds,
      critChance: input.critChance,
      agility: input.agility,
      defense: input.defense,
      maxHp: input.maxHp,
      imageData: input.imageData ?? null,
      powerLevel: input.powerLevel,
      nextEvolutionId: input.nextEvolutionId ?? null,
    };
  }
}
