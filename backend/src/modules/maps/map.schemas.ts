import { z } from "zod";
import { MAP_COLS, MAP_ROWS } from "./map.constants";

const tileCellSchema = z.number().int().min(0).nullable();
const collisionCellSchema = z.boolean();

const tileLayerSchema = z.array(z.array(tileCellSchema).length(MAP_COLS)).length(MAP_ROWS);
const collisionLayerSchema = z.array(z.array(collisionCellSchema).length(MAP_COLS)).length(MAP_ROWS);
const enemyAreaLayerSchema = collisionLayerSchema;
const portalAreaLayerSchema = collisionLayerSchema;

const mapEnemySpawnSchema = z.object({
  id: z.string().min(1).max(120),
  bestiaryAnimaId: z.string().min(1),
  bestiaryName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  imageData: z.string().max(55_000_000).nullable().optional().default(null),
  spriteScale: z.number().positive().optional().default(3),
  flipHorizontal: z.boolean().optional().default(true),
  spawnCount: z.number().int().min(1).max(500),
  respawnSeconds: z.number().min(0.5).max(3600),
  movementSpeed: z.number().min(0.25).optional().default(2.2),
  spawnArea: enemyAreaLayerSchema,
  movementArea: enemyAreaLayerSchema,
});

const mapPortalSchema = z.object({
  id: z.string().min(1).max(120),
  targetMapId: z.string().min(1),
  targetMapName: z.string().trim().min(1).max(120).nullable().optional().default(null),
  targetSpawnX: z.number().int().min(0).max(MAP_COLS - 1),
  targetSpawnY: z.number().int().min(0).max(MAP_ROWS - 1),
  area: portalAreaLayerSchema,
});

export const mapIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const createMapSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const updateActiveMapStateSchema = z.object({
  tileX: z.number().int().min(0).max(MAP_COLS - 1),
  tileY: z.number().int().min(0).max(MAP_ROWS - 1),
  scaleX: z.number().positive(),
  scaleY: z.number().positive(),
});

export const updateMapLayoutSchema = z.object({
  tileLayer: tileLayerSchema,
  collisionLayer: collisionLayerSchema,
  enemySpawns: z.array(mapEnemySpawnSchema).max(100).default([]),
  portals: z.array(mapPortalSchema).max(300).default([]),
  spawnX: z.number().int().min(0).max(MAP_COLS - 1),
  spawnY: z.number().int().min(0).max(MAP_ROWS - 1),
  backgroundScale: z.number().min(0.1).max(5),
});

export const usePortalSchema = z.object({
  portalId: z.string().min(1).max(120),
});

export const mapTileAssetSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  imageData: z.string().min(20).max(2_000_000),
});

export const updateMapAssetsSchema = z.object({
  backgroundImageData: z.string().min(20).max(20_000_000).nullable(),
  tilePalette: z.array(mapTileAssetSchema).max(500),
});
