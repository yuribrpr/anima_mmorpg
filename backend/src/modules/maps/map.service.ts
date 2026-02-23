import { AppError } from "../../lib/errors";
import {
  ActiveMapResponse,
  CreateMapInput,
  EnemyPresenceOutput,
  GameMapListItemOutput,
  GameMapOutput,
  PlayerPresenceOutput,
  PlayerMapStateOutput,
  UpdateMapInput,
  UsePortalInput,
  UpdateActiveMapStateInput,
  UpdateMapAssetsInput,
  UpdateMapLayoutInput,
} from "../../types/map";
import { MAP_DEFAULT_SCALE } from "./map.constants";
import { mapEnemyRuntimeRegistry } from "./map-enemy-runtime";
import { MapEntity, MapRepository, PlayerMapStateEntity, PlayerPresenceEntity } from "./map.repository";

const toMapOutput = (map: MapEntity): GameMapOutput => ({
  id: map.id,
  name: map.name,
  worldWidth: map.worldWidth,
  worldHeight: map.worldHeight,
  cellSize: map.cellSize,
  cols: map.cols,
  rows: map.rows,
  backgroundImageData: map.backgroundImageData,
  backgroundScale: map.backgroundScale,
  tilePalette: map.tilePalette,
  tileLayer: map.tileLayer,
  collisionLayer: map.collisionLayer,
  enemySpawns: map.enemySpawns,
  portals: map.portals,
  npcPlacements: map.npcPlacements,
  spawnX: map.spawnX,
  spawnY: map.spawnY,
  isActive: map.isActive,
  createdAt: map.createdAt,
  updatedAt: map.updatedAt,
});

const toMapListOutput = (map: MapEntity): GameMapListItemOutput => ({
  id: map.id,
  name: map.name,
  isActive: map.isActive,
  cols: map.cols,
  rows: map.rows,
  cellSize: map.cellSize,
  createdAt: map.createdAt,
  updatedAt: map.updatedAt,
});

const toPlayerMapStateOutput = (state: PlayerMapStateEntity): PlayerMapStateOutput => ({
  userId: state.userId,
  mapId: state.mapId,
  tileX: state.tileX,
  tileY: state.tileY,
  scaleX: state.scaleX,
  scaleY: state.scaleY,
  updatedAt: state.updatedAt,
});

const toPlayerPresenceOutput = (state: PlayerPresenceEntity): PlayerPresenceOutput => ({
  ...(state.user.adoptedAnimas[0]
    ? {
        animaName: state.user.adoptedAnimas[0].nickname || state.user.adoptedAnimas[0].baseAnima.name,
        animaLevel: state.user.adoptedAnimas[0].level,
        animaImageData: null,
        animaFlipHorizontal: state.user.adoptedAnimas[0].baseAnima.flipHorizontal,
        animaSpriteScale: state.user.adoptedAnimas[0].baseAnima.spriteScale,
      }
    : {
        animaName: null,
        animaLevel: null,
        animaImageData: null,
        animaFlipHorizontal: null,
        animaSpriteScale: null,
      }),
  userId: state.userId,
  username: state.user.username,
  mapId: state.mapId,
  tileX: state.tileX,
  tileY: state.tileY,
  scaleX: state.scaleX,
  scaleY: state.scaleY,
  updatedAt: state.updatedAt,
});

const toEnemyPresenceOutput = (snapshot: {
  id: string;
  groupId: string;
  tileX: number;
  tileY: number;
  facingX: -1 | 1;
  spawned: boolean;
  updatedAtMs: number;
}): EnemyPresenceOutput => ({
  id: snapshot.id,
  groupId: snapshot.groupId,
  tileX: snapshot.tileX,
  tileY: snapshot.tileY,
  facingX: snapshot.facingX,
  spawned: snapshot.spawned,
  updatedAt: new Date(snapshot.updatedAtMs),
});

export class MapService {
  constructor(private readonly mapRepository: MapRepository) {}

  private async getOrCreateActiveMap() {
    const existing = await this.mapRepository.findActive();
    if (existing) {
      return existing;
    }

    return this.mapRepository.createDefaultActive("Mapa Inicial");
  }

  private async ensureMapExists(id: string) {
    const map = await this.mapRepository.findById(id);
    if (!map) {
      throw new AppError(404, "MAP_NOT_FOUND", "Map not found");
    }
    return map;
  }

  private async resolveCurrentMapWithState(userId: string) {
    const latestState = await this.mapRepository.findLatestPlayerState(userId);
    if (latestState) {
      const latestMap = await this.mapRepository.findById(latestState.mapId);
      if (latestMap) {
        return { map: latestMap, state: latestState };
      }
    }

    const activeMap = await this.getOrCreateActiveMap();
    const existingState = await this.mapRepository.findPlayerState(userId, activeMap.id);
    const state =
      existingState ??
      (await this.mapRepository.createPlayerState(userId, activeMap.id, activeMap.spawnX, activeMap.spawnY));

    return { map: activeMap, state };
  }

  async getActiveWithState(userId: string): Promise<ActiveMapResponse> {
    const { map, state } = await this.resolveCurrentMapWithState(userId);

    return {
      map: toMapOutput(map),
      state: toPlayerMapStateOutput(state),
    };
  }

  async updateActiveState(userId: string, input: UpdateActiveMapStateInput) {
    const { map } = await this.resolveCurrentMapWithState(userId);
    const state = await this.mapRepository.upsertPlayerState(userId, map.id, input);

    return toPlayerMapStateOutput(state);
  }

  async listActivePlayers(userId: string) {
    const { map } = await this.resolveCurrentMapWithState(userId);
    const updatedAfter = new Date(Date.now() - 20_000);
    const states = await this.mapRepository.listPlayerPresenceByMap(map.id, userId, updatedAfter);
    return states.map(toPlayerPresenceOutput);
  }

  async listActiveEnemies(userId: string) {
    const { map } = await this.resolveCurrentMapWithState(userId);
    const snapshot = mapEnemyRuntimeRegistry.getSnapshot(map, Date.now());
    return snapshot.map(toEnemyPresenceOutput);
  }

  async usePortal(userId: string, input: UsePortalInput): Promise<ActiveMapResponse> {
    const { map: currentMap, state: currentState } = await this.resolveCurrentMapWithState(userId);
    const portal = currentMap.portals.find((item) => item.id === input.portalId);
    if (!portal) {
      throw new AppError(404, "PORTAL_NOT_FOUND", "Portal not found");
    }

    const targetMap = await this.ensureMapExists(portal.targetMapId);
    const nextScaleX = currentState.scaleX > 0 ? currentState.scaleX : MAP_DEFAULT_SCALE;
    const nextScaleY = currentState.scaleY > 0 ? currentState.scaleY : MAP_DEFAULT_SCALE;
    const destinationState = await this.mapRepository.upsertPlayerState(userId, targetMap.id, {
      tileX: portal.targetSpawnX,
      tileY: portal.targetSpawnY,
      scaleX: nextScaleX,
      scaleY: nextScaleY,
    });

    return {
      map: toMapOutput(targetMap),
      state: toPlayerMapStateOutput(destinationState),
    };
  }

  async list() {
    const maps = await this.mapRepository.list();
    return maps.map(toMapListOutput);
  }

  async create(input: CreateMapInput) {
    const map = await this.mapRepository.create(input.name.trim());
    return toMapOutput(map);
  }

  async update(id: string, input: UpdateMapInput) {
    await this.ensureMapExists(id);
    const map = await this.mapRepository.updateName(id, input.name.trim());
    await this.mapRepository.syncPortalTargetName(id, map.name);
    return toMapOutput(map);
  }

  async getById(id: string) {
    const map = await this.ensureMapExists(id);
    return toMapOutput(map);
  }

  async updateLayout(id: string, input: UpdateMapLayoutInput) {
    await this.ensureMapExists(id);
    const map = await this.mapRepository.updateLayout(id, input);
    return toMapOutput(map);
  }

  async updateAssets(id: string, input: UpdateMapAssetsInput) {
    await this.ensureMapExists(id);
    const map = await this.mapRepository.updateAssets(id, input);
    return toMapOutput(map);
  }

  async activate(id: string) {
    await this.ensureMapExists(id);
    const map = await this.mapRepository.setActive(id);
    return toMapOutput(map);
  }

  async delete(id: string) {
    const maps = await this.mapRepository.list();
    const target = maps.find((item) => item.id === id) ?? null;
    if (!target) {
      throw new AppError(404, "MAP_NOT_FOUND", "Map not found");
    }

    if (maps.length <= 1) {
      throw new AppError(400, "MAP_DELETE_LAST_FORBIDDEN", "At least one map must remain");
    }

    const fallback = maps.find((item) => item.id !== id) ?? null;
    await this.mapRepository.removePortalsReferencingMapId(id);
    await this.mapRepository.delete(id);

    if (target.isActive && fallback) {
      await this.mapRepository.setActive(fallback.id);
    }
  }

  async resetStateToSpawn(userId: string, mapId: string, spawnX: number, spawnY: number) {
    const state = await this.mapRepository.upsertPlayerState(userId, mapId, {
      tileX: spawnX,
      tileY: spawnY,
      scaleX: MAP_DEFAULT_SCALE,
      scaleY: MAP_DEFAULT_SCALE,
    });

    return toPlayerMapStateOutput(state);
  }
}
