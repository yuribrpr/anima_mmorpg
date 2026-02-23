import { UpdateActiveMapStateInput, UpdateMapAssetsInput, UpdateMapLayoutInput } from "../../src/types/map";
import {
  createEmptyCollisionLayer,
  createEmptyTileLayer,
  MapEntity,
  MapRepository,
  PlayerMapStateEntity,
} from "../../src/modules/maps/map.repository";
import { MAP_CELL_SIZE, MAP_COLS, MAP_DEFAULT_SCALE, MAP_ROWS, MAP_WORLD_HEIGHT, MAP_WORLD_WIDTH } from "../../src/modules/maps/map.constants";

const createMapEntity = (id: string, name: string, isActive: boolean): MapEntity => {
  const now = new Date();
  return {
    id,
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
    portals: [],
    spawnX: Math.floor(MAP_COLS / 2),
    spawnY: Math.floor(MAP_ROWS / 2),
    isActive,
    createdAt: now,
    updatedAt: now,
  };
};

export class InMemoryMapRepository implements MapRepository {
  private maps = new Map<string, MapEntity>();
  private states = new Map<string, PlayerMapStateEntity>();

  async findActive() {
    return [...this.maps.values()].find((map) => map.isActive) ?? null;
  }

  async createDefaultActive(name: string) {
    for (const map of this.maps.values()) {
      map.isActive = false;
      map.updatedAt = new Date();
    }

    const map = createMapEntity(`map_${this.maps.size + 1}`, name, true);
    this.maps.set(map.id, map);
    return map;
  }

  async list() {
    return [...this.maps.values()].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }

  async create(name: string) {
    const map = createMapEntity(`map_${this.maps.size + 1}`, name, false);
    this.maps.set(map.id, map);
    return map;
  }

  async findById(id: string) {
    return this.maps.get(id) ?? null;
  }

  async updateLayout(id: string, input: UpdateMapLayoutInput) {
    const map = this.maps.get(id);
    if (!map) {
      throw new Error("Map not found");
    }

    map.tileLayer = input.tileLayer;
    map.collisionLayer = input.collisionLayer;
    map.enemySpawns = input.enemySpawns;
    map.portals = input.portals;
    map.spawnX = input.spawnX;
    map.spawnY = input.spawnY;
    map.backgroundScale = input.backgroundScale;
    map.updatedAt = new Date();
    return map;
  }

  async updateAssets(id: string, input: UpdateMapAssetsInput) {
    const map = this.maps.get(id);
    if (!map) {
      throw new Error("Map not found");
    }

    map.backgroundImageData = input.backgroundImageData;
    map.tilePalette = input.tilePalette;
    map.updatedAt = new Date();
    return map;
  }

  async setActive(id: string) {
    for (const map of this.maps.values()) {
      map.isActive = false;
      map.updatedAt = new Date();
    }

    const map = this.maps.get(id);
    if (!map) {
      throw new Error("Map not found");
    }

    map.isActive = true;
    map.updatedAt = new Date();
    return map;
  }

  async findPlayerState(userId: string, mapId: string) {
    return this.states.get(`${userId}:${mapId}`) ?? null;
  }

  async findLatestPlayerState(userId: string) {
    let latest: PlayerMapStateEntity | null = null;
    for (const state of this.states.values()) {
      if (state.userId !== userId) continue;
      if (!latest || state.updatedAt > latest.updatedAt) {
        latest = state;
      }
    }
    return latest;
  }

  async upsertPlayerState(userId: string, mapId: string, input: UpdateActiveMapStateInput) {
    const key = `${userId}:${mapId}`;
    const now = new Date();
    const existing = this.states.get(key);
    const state: PlayerMapStateEntity = existing
      ? {
          ...existing,
          tileX: input.tileX,
          tileY: input.tileY,
          scaleX: input.scaleX,
          scaleY: input.scaleY,
          updatedAt: now,
        }
      : {
          id: `state_${this.states.size + 1}`,
          userId,
          mapId,
          tileX: input.tileX,
          tileY: input.tileY,
          scaleX: input.scaleX,
          scaleY: input.scaleY,
          createdAt: now,
          updatedAt: now,
        };

    this.states.set(key, state);
    return state;
  }

  async createPlayerState(userId: string, mapId: string, tileX: number, tileY: number) {
    const now = new Date();
    const state: PlayerMapStateEntity = {
      id: `state_${this.states.size + 1}`,
      userId,
      mapId,
      tileX,
      tileY,
      scaleX: MAP_DEFAULT_SCALE,
      scaleY: MAP_DEFAULT_SCALE,
      createdAt: now,
      updatedAt: now,
    };

    this.states.set(`${userId}:${mapId}`, state);
    return state;
  }

  async listPlayerPresenceByMap(mapId: string, excludeUserId: string, updatedAfter: Date) {
    const list: Array<
      PlayerMapStateEntity & {
        user: {
          username: string;
          adoptedAnimas: Array<{
            nickname: string;
            level: number;
            baseAnima: {
              name: string;
              imageData: string | null;
              flipHorizontal: boolean;
              spriteScale: number;
            };
          }>;
        };
      }
    > = [];
    for (const state of this.states.values()) {
      if (state.mapId !== mapId || state.userId === excludeUserId || state.updatedAt < updatedAfter) {
        continue;
      }
      list.push({
        ...state,
        user: {
          username: `player_${state.userId.slice(0, 6)}`,
          adoptedAnimas: [],
        },
      });
    }
    return list;
  }
}
