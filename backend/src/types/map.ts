export type MapTileAsset = {
  id: string;
  name: string;
  imageData: string;
};

export type EnemyAreaLayer = boolean[][];

export type MapEnemySpawnConfig = {
  id: string;
  bestiaryAnimaId: string;
  bestiaryName: string | null;
  imageData: string | null;
  spriteScale: number;
  flipHorizontal: boolean;
  spawnCount: number;
  respawnSeconds: number;
  movementSpeed: number;
  spawnArea: EnemyAreaLayer;
  movementArea: EnemyAreaLayer;
};

export type MapPortalConfig = {
  id: string;
  targetMapId: string;
  targetMapName: string | null;
  targetSpawnX: number;
  targetSpawnY: number;
  area: boolean[][];
};

export type MapNpcPlacementConfig = {
  id: string;
  npcId: string;
  npcName: string | null;
  imageData: string | null;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
};

export type GameMapOutput = {
  id: string;
  name: string;
  worldWidth: number;
  worldHeight: number;
  cellSize: number;
  cols: number;
  rows: number;
  backgroundImageData: string | null;
  backgroundScale: number;
  tilePalette: MapTileAsset[];
  tileLayer: (number | null)[][];
  collisionLayer: boolean[][];
  enemySpawns: MapEnemySpawnConfig[];
  portals: MapPortalConfig[];
  npcPlacements: MapNpcPlacementConfig[];
  spawnX: number;
  spawnY: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GameMapListItemOutput = Pick<
  GameMapOutput,
  "id" | "name" | "isActive" | "cols" | "rows" | "cellSize" | "createdAt" | "updatedAt"
>;

export type PlayerMapStateOutput = {
  userId: string;
  mapId: string;
  tileX: number;
  tileY: number;
  scaleX: number;
  scaleY: number;
  updatedAt: Date;
};

export type PlayerPresenceOutput = PlayerMapStateOutput & {
  username: string;
  animaName: string | null;
  animaLevel: number | null;
  animaImageData: string | null;
  animaFlipHorizontal: boolean | null;
  animaSpriteScale: number | null;
};

export type EnemyPresenceOutput = {
  id: string;
  groupId: string;
  tileX: number;
  tileY: number;
  facingX: -1 | 1;
  spawned: boolean;
  updatedAt: Date;
};

export type CreateMapInput = {
  name: string;
};

export type UpdateMapInput = {
  name: string;
};

export type UpdateActiveMapStateInput = {
  tileX: number;
  tileY: number;
  scaleX: number;
  scaleY: number;
};

export type UpdateMapLayoutInput = {
  tileLayer: (number | null)[][];
  collisionLayer: boolean[][];
  enemySpawns: MapEnemySpawnConfig[];
  portals: MapPortalConfig[];
  npcPlacements: MapNpcPlacementConfig[];
  spawnX: number;
  spawnY: number;
  backgroundScale: number;
};

export type UpdateMapAssetsInput = {
  backgroundImageData: string | null;
  tilePalette: MapTileAsset[];
};

export type ActiveMapResponse = {
  map: GameMapOutput;
  state: PlayerMapStateOutput;
};

export type UsePortalInput = {
  portalId: string;
};
