import { AppError } from "../../lib/errors";
import {
  ActiveMapResponse,
  CreateMapInput,
  GameMapListItemOutput,
  GameMapOutput,
  PlayerMapStateOutput,
  UsePortalInput,
  UpdateActiveMapStateInput,
  UpdateMapAssetsInput,
  UpdateMapLayoutInput,
} from "../../types/map";
import { MAP_DEFAULT_SCALE } from "./map.constants";
import { MapEntity, MapRepository, PlayerMapStateEntity } from "./map.repository";

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
