import { AppError } from "../../lib/errors";
import { CreateBestiaryAnimaInput, UpdateBestiaryAnimaInput } from "../../types/bestiary-anima";
import { BestiaryAnimaRepository } from "./bestiary.repository";

export class BestiaryAnimaService {
  constructor(private readonly bestiaryAnimaRepository: BestiaryAnimaRepository) {}

  async list() {
    return this.bestiaryAnimaRepository.list();
  }

  async create(input: CreateBestiaryAnimaInput) {
    const data = this.prepareCreateOrUpdateData(input);
    return this.bestiaryAnimaRepository.create(data);
  }

  async update(id: string, input: UpdateBestiaryAnimaInput) {
    const existing = await this.bestiaryAnimaRepository.findById(id);

    if (!existing) {
      throw new AppError(404, "BESTIARY_ANIMA_NOT_FOUND", "Bestiary anima not found");
    }

    const data = this.prepareCreateOrUpdateData(input);
    return this.bestiaryAnimaRepository.update(id, data);
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
      powerLevel: input.powerLevel,
      bitsDrop,
      xpDrop,
    };
  }
}
