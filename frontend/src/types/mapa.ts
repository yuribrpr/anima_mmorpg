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

export type GameMap = {
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
  createdAt: string;
  updatedAt: string;
};

export type GameMapListItem = {
  id: string;
  name: string;
  isActive: boolean;
  cols: number;
  rows: number;
  cellSize: number;
  createdAt: string;
  updatedAt: string;
};

export type PlayerMapState = {
  userId: string;
  mapId: string;
  tileX: number;
  tileY: number;
  scaleX: number;
  scaleY: number;
  updatedAt: string;
};

export type ActiveMapPayload = {
  map: GameMap;
  state: PlayerMapState;
};

export type MapLayoutPayload = {
  tileLayer: (number | null)[][];
  collisionLayer: boolean[][];
  enemySpawns: MapEnemySpawnConfig[];
  spawnX: number;
  spawnY: number;
  backgroundScale: number;
};

export type MapAssetsPayload = {
  backgroundImageData: string | null;
  tilePalette: MapTileAsset[];
};
