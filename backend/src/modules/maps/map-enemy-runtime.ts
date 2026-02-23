import { MapEntity } from "./map.repository";

type GridPoint = {
  x: number;
  y: number;
};

type EnemyRuntimeSnapshot = {
  id: string;
  groupId: string;
  tileX: number;
  tileY: number;
  facingX: -1 | 1;
  spawned: boolean;
  updatedAtMs: number;
};

type EnemyGroupRuntime = {
  id: string;
  spawnTiles: GridPoint[];
  movementTiles: GridPoint[];
  movementMask: boolean[][];
  respawnMs: number;
  movementSpeed: number;
  spawnCount: number;
};

type EnemyRuntimeState = {
  id: string;
  groupId: string;
  tileX: number;
  tileY: number;
  facingX: -1 | 1;
  spawned: boolean;
  respawnAtMs: number;
  nextDecisionAtMs: number;
  updatedAtMs: number;
};

type MapEnemyRuntime = {
  mapId: string;
  mapUpdatedAtMs: number;
  cols: number;
  rows: number;
  collisionLayer: boolean[][];
  groups: Map<string, EnemyGroupRuntime>;
  enemies: EnemyRuntimeState[];
  rng: () => number;
  lastTickMs: number;
};

const SIM_STEP_MS = 120;
const MAX_CATCH_UP_MS = 30_000;

const DIRECTIONS: GridPoint[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createMulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randomRange = (rng: () => number, min: number, max: number) => min + (max - min) * rng();

const randomDecisionDelay = (group: EnemyGroupRuntime, rng: () => number) => {
  const base = randomRange(rng, 320, 980);
  const scaled = base / clamp(group.movementSpeed, 0.25, 5);
  return Math.floor(clamp(scaled, 110, 2200));
};

const isInside = (point: GridPoint, cols: number, rows: number) => point.x >= 0 && point.x < cols && point.y >= 0 && point.y < rows;

const isTileOccupied = (enemies: EnemyRuntimeState[], candidate: GridPoint, ignoreId: string | null) =>
  enemies.some((enemy) => enemy.spawned && enemy.id !== ignoreId && enemy.tileX === candidate.x && enemy.tileY === candidate.y);

const pickRandom = <T,>(items: T[], rng: () => number): T | null => {
  if (items.length === 0) {
    return null;
  }
  const index = Math.floor(rng() * items.length);
  return items[index] ?? null;
};

const collectAreaTiles = (area: boolean[][], collisionLayer: boolean[][], rows: number, cols: number) => {
  const tiles: GridPoint[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (area[y]?.[x] === true && collisionLayer[y]?.[x] !== true) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
};

const buildMovementMask = (area: boolean[][], collisionLayer: boolean[][], rows: number, cols: number) =>
  Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => collisionLayer[y]?.[x] === true || area[y]?.[x] !== true));

const canUseTile = (runtime: MapEnemyRuntime, group: EnemyGroupRuntime, candidate: GridPoint, enemyId: string) => {
  if (!isInside(candidate, runtime.cols, runtime.rows)) {
    return false;
  }
  if (runtime.collisionLayer[candidate.y]?.[candidate.x] === true) {
    return false;
  }
  if (group.movementMask[candidate.y]?.[candidate.x] === true) {
    return false;
  }
  if (isTileOccupied(runtime.enemies, candidate, enemyId)) {
    return false;
  }
  return true;
};

const pickSpawnTile = (runtime: MapEnemyRuntime, group: EnemyGroupRuntime, enemyId: string) => {
  const source = group.spawnTiles.length > 0 ? group.spawnTiles : group.movementTiles;
  const candidates = source.filter((tile) => canUseTile(runtime, group, tile, enemyId));
  return pickRandom(candidates, runtime.rng);
};

const stepEnemy = (runtime: MapEnemyRuntime, enemy: EnemyRuntimeState, nowMs: number) => {
  const group = runtime.groups.get(enemy.groupId);
  if (!group) {
    return;
  }

  if (!enemy.spawned) {
    if (nowMs < enemy.respawnAtMs) {
      return;
    }

    const spawnTile = pickSpawnTile(runtime, group, enemy.id);
    if (!spawnTile) {
      enemy.respawnAtMs = nowMs + group.respawnMs;
      enemy.updatedAtMs = nowMs;
      return;
    }

    enemy.spawned = true;
    enemy.tileX = spawnTile.x;
    enemy.tileY = spawnTile.y;
    enemy.facingX = runtime.rng() > 0.5 ? 1 : -1;
    enemy.nextDecisionAtMs = nowMs + randomDecisionDelay(group, runtime.rng);
    enemy.updatedAtMs = nowMs;
    return;
  }

  if (nowMs < enemy.nextDecisionAtMs) {
    return;
  }

  const current = { x: enemy.tileX, y: enemy.tileY };
  const candidates = DIRECTIONS.map((direction) => ({ x: current.x + direction.x, y: current.y + direction.y })).filter((candidate) =>
    canUseTile(runtime, group, candidate, enemy.id),
  );
  const next = pickRandom(candidates, runtime.rng);
  if (!next) {
    enemy.nextDecisionAtMs = nowMs + Math.floor(randomRange(runtime.rng, 220, 700));
    return;
  }

  const dx = next.x - enemy.tileX;
  if (dx > 0) {
    enemy.facingX = 1;
  } else if (dx < 0) {
    enemy.facingX = -1;
  }

  enemy.tileX = next.x;
  enemy.tileY = next.y;
  enemy.nextDecisionAtMs = nowMs + randomDecisionDelay(group, runtime.rng);
  enemy.updatedAtMs = nowMs;
};

const simulateRuntime = (runtime: MapEnemyRuntime, nowMs: number) => {
  const cappedTargetMs = Math.max(runtime.lastTickMs, nowMs - MAX_CATCH_UP_MS);
  let tick = runtime.lastTickMs;
  while (tick + SIM_STEP_MS <= cappedTargetMs) {
    tick += SIM_STEP_MS;
    for (const enemy of runtime.enemies) {
      stepEnemy(runtime, enemy, tick);
    }
  }
  runtime.lastTickMs = Math.max(tick, cappedTargetMs);
};

const createRuntimeForMap = (map: MapEntity, nowMs: number): MapEnemyRuntime => {
  const mapUpdatedAtMs = new Date(map.updatedAt).getTime();
  const seed = hashString(`${map.id}:${mapUpdatedAtMs}`);
  const rng = createMulberry32(seed || 1);
  const groups = new Map<string, EnemyGroupRuntime>();
  const enemies: EnemyRuntimeState[] = [];

  for (const config of map.enemySpawns ?? []) {
    const spawnTiles = collectAreaTiles(config.spawnArea, map.collisionLayer, map.rows, map.cols);
    const movementTiles = collectAreaTiles(config.movementArea, map.collisionLayer, map.rows, map.cols);
    const finalMovementTiles = movementTiles.length > 0 ? movementTiles : spawnTiles;
    const finalMovementArea = movementTiles.length > 0 ? config.movementArea : config.spawnArea;
    const group: EnemyGroupRuntime = {
      id: config.id,
      spawnTiles,
      movementTiles: finalMovementTiles,
      movementMask: buildMovementMask(finalMovementArea, map.collisionLayer, map.rows, map.cols),
      respawnMs: Math.max(500, Math.floor(config.respawnSeconds * 1000)),
      movementSpeed: Math.max(0.25, config.movementSpeed ?? 2.2),
      spawnCount: Math.max(1, Math.floor(config.spawnCount)),
    };
    groups.set(config.id, group);

    for (let index = 0; index < group.spawnCount; index += 1) {
      const runtimeId = `${config.id}:${index}`;
      const spawnTile = pickSpawnTile(
        {
          mapId: map.id,
          mapUpdatedAtMs,
          cols: map.cols,
          rows: map.rows,
          collisionLayer: map.collisionLayer,
          groups,
          enemies,
          rng,
          lastTickMs: nowMs,
        },
        group,
        runtimeId,
      );

      enemies.push({
        id: runtimeId,
        groupId: config.id,
        tileX: spawnTile?.x ?? map.spawnX,
        tileY: spawnTile?.y ?? map.spawnY,
        facingX: -1,
        spawned: Boolean(spawnTile),
        respawnAtMs: spawnTile ? 0 : nowMs + group.respawnMs,
        nextDecisionAtMs: nowMs + Math.floor(randomRange(rng, 300, 1300)),
        updatedAtMs: nowMs,
      });
    }
  }

  return {
    mapId: map.id,
    mapUpdatedAtMs,
    cols: map.cols,
    rows: map.rows,
    collisionLayer: map.collisionLayer,
    groups,
    enemies,
    rng,
    lastTickMs: nowMs,
  };
};

export class MapEnemyRuntimeRegistry {
  private runtimes = new Map<string, MapEnemyRuntime>();

  getSnapshot(map: MapEntity, nowMs = Date.now()): EnemyRuntimeSnapshot[] {
    const mapUpdatedAtMs = new Date(map.updatedAt).getTime();
    const existing = this.runtimes.get(map.id);
    const runtime =
      !existing || existing.mapUpdatedAtMs !== mapUpdatedAtMs ? createRuntimeForMap(map, nowMs) : existing;

    if (!existing || existing.mapUpdatedAtMs !== mapUpdatedAtMs) {
      this.runtimes.set(map.id, runtime);
    }

    simulateRuntime(runtime, nowMs);

    return runtime.enemies.map((enemy) => ({
      id: enemy.id,
      groupId: enemy.groupId,
      tileX: enemy.tileX,
      tileY: enemy.tileY,
      facingX: enemy.facingX,
      spawned: enemy.spawned,
      updatedAtMs: enemy.updatedAtMs,
    }));
  }
}

export const mapEnemyRuntimeRegistry = new MapEnemyRuntimeRegistry();
