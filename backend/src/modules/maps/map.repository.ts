import { GameMap, PlayerMapState, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { MapEnemySpawnConfig, MapTileAsset, UpdateActiveMapStateInput, UpdateMapAssetsInput, UpdateMapLayoutInput } from "../../types/map";
import { MAP_CELL_SIZE, MAP_COLS, MAP_DEFAULT_SCALE, MAP_ROWS, MAP_WORLD_HEIGHT, MAP_WORLD_WIDTH } from "./map.constants";

type MapEntity = Omit<GameMap, "tilePalette" | "tileLayer" | "collisionLayer" | "enemySpawns"> & {
  tilePalette: MapTileAsset[];
  tileLayer: (number | null)[][];
  collisionLayer: boolean[][];
  enemySpawns: MapEnemySpawnConfig[];
};

type PlayerMapStateEntity = PlayerMapState;

const createEmptyTileLayer = () => Array.from({ length: MAP_ROWS }, () => Array.from({ length: MAP_COLS }, () => null as number | null));
const createEmptyCollisionLayer = () => Array.from({ length: MAP_ROWS }, () => Array.from({ length: MAP_COLS }, () => false));

const normalizeTilePalette = (value: Prisma.JsonValue): MapTileAsset[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).imageData === "string",
    )
    .map((item) => {
      const data = item as Record<string, unknown>;
      return {
        id: String(data.id),
        name: String(data.name),
        imageData: String(data.imageData),
      };
    });
};

const normalizeTileLayer = (value: Prisma.JsonValue): (number | null)[][] => {
  if (!Array.isArray(value)) {
    return createEmptyTileLayer();
  }

  return Array.from({ length: MAP_ROWS }, (_, rowIndex) => {
    const row = value[rowIndex];
    if (!Array.isArray(row)) {
      return Array.from({ length: MAP_COLS }, () => null as number | null);
    }

    return Array.from({ length: MAP_COLS }, (_, colIndex) => {
      const cell = row[colIndex];
      if (cell === null) {
        return null;
      }

      return typeof cell === "number" && Number.isInteger(cell) && cell >= 0 ? cell : null;
    });
  });
};

const normalizeCollisionLayer = (value: Prisma.JsonValue): boolean[][] => {
  if (!Array.isArray(value)) {
    return createEmptyCollisionLayer();
  }

  return Array.from({ length: MAP_ROWS }, (_, rowIndex) => {
    const row = value[rowIndex];
    if (!Array.isArray(row)) {
      return Array.from({ length: MAP_COLS }, () => false);
    }

    return Array.from({ length: MAP_COLS }, (_, colIndex) => row[colIndex] === true);
  });
};

const normalizeEnemyAreaLayer = (value: unknown): boolean[][] => {
  if (!Array.isArray(value)) {
    return createEmptyCollisionLayer();
  }

  return Array.from({ length: MAP_ROWS }, (_, rowIndex) => {
    const row = value[rowIndex];
    if (!Array.isArray(row)) {
      return Array.from({ length: MAP_COLS }, () => false);
    }

    return Array.from({ length: MAP_COLS }, (_, colIndex) => row[colIndex] === true);
  });
};

const normalizeEnemySpawns = (value: Prisma.JsonValue | null | undefined): MapEnemySpawnConfig[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: MapEnemySpawnConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const data = item as Record<string, unknown>;
    if (typeof data.id !== "string" || typeof data.bestiaryAnimaId !== "string") {
      continue;
    }

    const spawnCount = typeof data.spawnCount === "number" && Number.isInteger(data.spawnCount) ? data.spawnCount : 1;
    const respawnSeconds = typeof data.respawnSeconds === "number" ? data.respawnSeconds : 15;
    output.push({
      id: data.id,
      bestiaryAnimaId: data.bestiaryAnimaId,
      spawnCount: Math.max(1, spawnCount),
      respawnSeconds: Math.max(0.5, respawnSeconds),
      spawnArea: normalizeEnemyAreaLayer(data.spawnArea),
      movementArea: normalizeEnemyAreaLayer(data.movementArea),
    });
  }

  return output;
};

const toEntity = (map: GameMap): MapEntity => ({
  ...map,
  tilePalette: normalizeTilePalette(map.tilePalette),
  tileLayer: normalizeTileLayer(map.tileLayer),
  collisionLayer: normalizeCollisionLayer(map.collisionLayer),
  enemySpawns: normalizeEnemySpawns(map.enemySpawns),
});

const defaultMapCreateData = (name: string, isActive: boolean) => ({
  name,
  worldWidth: MAP_WORLD_WIDTH,
  worldHeight: MAP_WORLD_HEIGHT,
  cellSize: MAP_CELL_SIZE,
  cols: MAP_COLS,
  rows: MAP_ROWS,
  backgroundImageData: null,
  backgroundScale: 1,
  tilePalette: [],
  tileLayer: createEmptyTileLayer(),
  collisionLayer: createEmptyCollisionLayer(),
  enemySpawns: [],
  spawnX: Math.floor(MAP_COLS / 2),
  spawnY: Math.floor(MAP_ROWS / 2),
  isActive,
});

export interface MapRepository {
  findActive(): Promise<MapEntity | null>;
  createDefaultActive(name: string): Promise<MapEntity>;
  list(): Promise<MapEntity[]>;
  create(name: string): Promise<MapEntity>;
  findById(id: string): Promise<MapEntity | null>;
  updateLayout(id: string, input: UpdateMapLayoutInput): Promise<MapEntity>;
  updateAssets(id: string, input: UpdateMapAssetsInput): Promise<MapEntity>;
  setActive(id: string): Promise<MapEntity>;
  findPlayerState(userId: string, mapId: string): Promise<PlayerMapStateEntity | null>;
  upsertPlayerState(userId: string, mapId: string, input: UpdateActiveMapStateInput): Promise<PlayerMapStateEntity>;
  createPlayerState(userId: string, mapId: string, tileX: number, tileY: number): Promise<PlayerMapStateEntity>;
}

export class PrismaMapRepository implements MapRepository {
  async findActive() {
    const map = await prisma.gameMap.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    return map ? toEntity(map) : null;
  }

  async createDefaultActive(name: string) {
    const map = await prisma.gameMap.create({
      data: defaultMapCreateData(name, true),
    });

    return toEntity(map);
  }

  async list() {
    const maps = await prisma.gameMap.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });

    return maps.map(toEntity);
  }

  async create(name: string) {
    const map = await prisma.gameMap.create({
      data: defaultMapCreateData(name, false),
    });

    return toEntity(map);
  }

  async findById(id: string) {
    const map = await prisma.gameMap.findUnique({ where: { id } });
    return map ? toEntity(map) : null;
  }

  async updateLayout(id: string, input: UpdateMapLayoutInput) {
    const map = await prisma.gameMap.update({
      where: { id },
      data: {
        tileLayer: input.tileLayer,
        collisionLayer: input.collisionLayer,
        enemySpawns: input.enemySpawns,
        spawnX: input.spawnX,
        spawnY: input.spawnY,
        backgroundScale: input.backgroundScale,
      },
    });

    return toEntity(map);
  }

  async updateAssets(id: string, input: UpdateMapAssetsInput) {
    const map = await prisma.gameMap.update({
      where: { id },
      data: {
        backgroundImageData: input.backgroundImageData,
        tilePalette: input.tilePalette,
      },
    });

    return toEntity(map);
  }

  async setActive(id: string) {
    const [, map] = await prisma.$transaction([
      prisma.gameMap.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.gameMap.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    return toEntity(map);
  }

  async findPlayerState(userId: string, mapId: string) {
    return prisma.playerMapState.findUnique({
      where: {
        userId_mapId: {
          userId,
          mapId,
        },
      },
    });
  }

  async upsertPlayerState(userId: string, mapId: string, input: UpdateActiveMapStateInput) {
    return prisma.playerMapState.upsert({
      where: {
        userId_mapId: {
          userId,
          mapId,
        },
      },
      update: {
        tileX: input.tileX,
        tileY: input.tileY,
        scaleX: input.scaleX,
        scaleY: input.scaleY,
      },
      create: {
        userId,
        mapId,
        tileX: input.tileX,
        tileY: input.tileY,
        scaleX: input.scaleX,
        scaleY: input.scaleY,
      },
    });
  }

  async createPlayerState(userId: string, mapId: string, tileX: number, tileY: number) {
    return prisma.playerMapState.create({
      data: {
        userId,
        mapId,
        tileX,
        tileY,
        scaleX: MAP_DEFAULT_SCALE,
        scaleY: MAP_DEFAULT_SCALE,
      },
    });
  }
}

export { createEmptyCollisionLayer, createEmptyTileLayer };
export type { MapEntity, PlayerMapStateEntity };
