export type MapTileAsset = {
  id: string;
  name: string;
  imageData: string;
};

export type EnemyAreaLayer = boolean[][];

export type MapEnemySpawnConfig = {
  id: string;
  bestiaryAnimaId: string;
  spawnCount: number;
  respawnSeconds: number;
  spawnArea: EnemyAreaLayer;
  movementArea: EnemyAreaLayer;
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

export type CreateMapInput = {
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
