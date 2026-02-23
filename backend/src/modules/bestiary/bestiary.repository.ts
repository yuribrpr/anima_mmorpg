import { BestiaryAnima, BestiaryDrop, Item, PowerLevel, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type BestiaryDropData = {
  itemId: string;
  quantity: number;
  dropChance: number;
};

export type CreateBestiaryAnimaData = {
  name: string;
  attack: number;
  attackSpeedSeconds: number;
  critChance: number;
  agility: number;
  defense: number;
  maxHp: number;
  imageData: string | null;
  spriteScale: number;
  flipHorizontal: boolean;
  powerLevel: PowerLevel;
  bitsDrop: number;
  xpDrop: number;
  drops: BestiaryDropData[];
};

export type UpdateBestiaryAnimaData = CreateBestiaryAnimaData;

export type BestiaryDropWithItem = BestiaryDrop & {
  item: Pick<Item, "id" | "name" | "type" | "imageData" | "stackSize" | "healPercentMaxHp" | "bonusAttack" | "bonusDefense" | "bonusMaxHp">;
};

export type BestiaryAnimaEntity = BestiaryAnima & {
  drops: BestiaryDropWithItem[];
};

const itemSelect = {
  id: true,
  name: true,
  type: true,
  imageData: true,
  stackSize: true,
  healPercentMaxHp: true,
  bonusAttack: true,
  bonusDefense: true,
  bonusMaxHp: true,
} as const;

const withDropsArgs = Prisma.validator<Prisma.BestiaryAnimaDefaultArgs>()({
  include: {
    drops: {
      include: {
        item: {
          select: itemSelect,
        },
      },
      orderBy: [{ dropChance: "desc" }, { createdAt: "asc" }],
    },
  },
});

type BestiaryAnimaWithDrops = Prisma.BestiaryAnimaGetPayload<typeof withDropsArgs>;

const toEntity = (anima: BestiaryAnimaWithDrops): BestiaryAnimaEntity => anima;

export interface BestiaryAnimaRepository {
  list(): Promise<BestiaryAnimaEntity[]>;
  findById(id: string): Promise<BestiaryAnimaEntity | null>;
  create(data: CreateBestiaryAnimaData): Promise<BestiaryAnimaEntity>;
  update(id: string, data: UpdateBestiaryAnimaData): Promise<BestiaryAnimaEntity>;
  delete(id: string): Promise<void>;
}

export class PrismaBestiaryAnimaRepository implements BestiaryAnimaRepository {
  async list() {
    const items = await prisma.bestiaryAnima.findMany({
      ...withDropsArgs,
      orderBy: {
        createdAt: "desc",
      },
    });
    return items.map(toEntity);
  }

  async findById(id: string) {
    const item = await prisma.bestiaryAnima.findUnique({
      where: { id },
      ...withDropsArgs,
    });
    return item ? toEntity(item) : null;
  }

  async create(data: CreateBestiaryAnimaData) {
    const { drops, ...rest } = data;
    const anima = await prisma.bestiaryAnima.create({
      data: {
        ...rest,
        drops: {
          create: drops.map((drop) => ({
            itemId: drop.itemId,
            quantity: drop.quantity,
            dropChance: drop.dropChance,
          })),
        },
      },
      ...withDropsArgs,
    });
    return toEntity(anima);
  }

  async update(id: string, data: UpdateBestiaryAnimaData) {
    const { drops, ...rest } = data;
    const [, anima] = await prisma.$transaction([
      prisma.bestiaryDrop.deleteMany({
        where: { bestiaryAnimaId: id },
      }),
      prisma.bestiaryAnima.update({
        where: { id },
        data: {
          ...rest,
          drops: {
            create: drops.map((drop) => ({
              itemId: drop.itemId,
              quantity: drop.quantity,
              dropChance: drop.dropChance,
            })),
          },
        },
        ...withDropsArgs,
      }),
    ]);
    return toEntity(anima);
  }

  async delete(id: string) {
    await prisma.bestiaryAnima.delete({
      where: { id },
    });
  }
}
