import { prisma } from "../../config/prisma";
import type { GlobalSettingsOutput, UpdateGlobalSettingsInput } from "../../types/global-settings";

const clampMultiplier = (value: number) => Math.max(0, Math.min(1_000_000, Number(value)));

export class GlobalSettingsService {
  private async getOrCreate() {
    const existing = await prisma.globalSettings.findUnique({
      where: { singletonKey: "global" },
    });

    if (existing) {
      return existing;
    }

    return prisma.globalSettings.create({
      data: {
        singletonKey: "global",
        expMultiplier: 1,
        bitsMultiplier: 1,
      },
    });
  }

  private toOutput(entity: Awaited<ReturnType<GlobalSettingsService["getOrCreate"]>>): GlobalSettingsOutput {
    return {
      id: entity.id,
      expMultiplier: entity.expMultiplier,
      bitsMultiplier: entity.bitsMultiplier,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async get() {
    const settings = await this.getOrCreate();
    return this.toOutput(settings);
  }

  async update(input: UpdateGlobalSettingsInput) {
    const existing = await this.getOrCreate();
    const updated = await prisma.globalSettings.update({
      where: { id: existing.id },
      data: {
        expMultiplier: clampMultiplier(input.expMultiplier),
        bitsMultiplier: clampMultiplier(input.bitsMultiplier),
      },
    });

    return this.toOutput(updated);
  }
}
