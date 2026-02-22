export const GRID_COLS = 60;
export const GRID_ROWS = 34;
export const TILE_SIZE = 32;
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1088;
export const RENDER_BASE_HEIGHT = 1080;

export type GridPoint = {
  x: number;
  y: number;
};

const DIAGONAL_DIRS: GridPoint[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export const isInsideGrid = (point: GridPoint) => point.x >= 0 && point.x < GRID_COLS && point.y >= 0 && point.y < GRID_ROWS;

export const canWalk = (point: GridPoint, collisions: boolean[][]) => isInsideGrid(point) && collisions[point.y]?.[point.x] !== true;

const nodeKey = (point: GridPoint) => `${point.x}:${point.y}`;

const euclidean = (a: GridPoint, b: GridPoint) => Math.hypot(a.x - b.x, a.y - b.y);

type PathOptions = {
  allowCornerCut?: boolean;
};

const neighbors = (point: GridPoint, collisions: boolean[][], options: PathOptions = {}): GridPoint[] => {
  const items: GridPoint[] = [];
  const allowCornerCut = options.allowCornerCut === true;

  for (const direction of DIAGONAL_DIRS) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    if (!canWalk(next, collisions)) {
      continue;
    }

    if (!allowCornerCut && direction.x !== 0 && direction.y !== 0) {
      const sideA = { x: point.x + direction.x, y: point.y };
      const sideB = { x: point.x, y: point.y + direction.y };
      if (!canWalk(sideA, collisions) || !canWalk(sideB, collisions)) {
        continue;
      }
    }

    items.push(next);
  }

  return items;
};

export const findNearestWalkableTile = (origin: GridPoint, collisions: boolean[][]): GridPoint | null => {
  if (canWalk(origin, collisions)) {
    return origin;
  }

  const visited = new Set<string>();
  const queue: GridPoint[] = [origin];
  visited.add(nodeKey(origin));

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of DIAGONAL_DIRS) {
      const next = {
        x: current.x + direction.x,
        y: current.y + direction.y,
      };

      if (!isInsideGrid(next)) {
        continue;
      }

      const key = nodeKey(next);
      if (visited.has(key)) {
        continue;
      }

      if (canWalk(next, collisions)) {
        return next;
      }

      visited.add(key);
      queue.push(next);
    }
  }

  return null;
};

export const findPathAStar = (start: GridPoint, goal: GridPoint, collisions: boolean[][], options: PathOptions = {}): GridPoint[] => {
  if (!canWalk(start, collisions) || !canWalk(goal, collisions)) {
    return [];
  }

  if (start.x === goal.x && start.y === goal.y) {
    return [start];
  }

  const open = new Set<string>([nodeKey(start)]);
  const closed = new Set<string>();
  const cameFrom = new Map<string, GridPoint>();
  const gScore = new Map<string, number>([[nodeKey(start), 0]]);
  const fScore = new Map<string, number>([[nodeKey(start), euclidean(start, goal)]]);
  const points = new Map<string, GridPoint>([[nodeKey(start), start]]);

  while (open.size > 0) {
    let currentKey = "";
    let currentF = Number.POSITIVE_INFINITY;
    for (const key of open) {
      const score = fScore.get(key) ?? Number.POSITIVE_INFINITY;
      if (score < currentF) {
        currentF = score;
        currentKey = key;
      }
    }

    if (!currentKey) {
      break;
    }

    const current = points.get(currentKey);
    if (!current) {
      open.delete(currentKey);
      continue;
    }

    if (current.x === goal.x && current.y === goal.y) {
      const path: GridPoint[] = [current];
      let stepKey = currentKey;

      while (cameFrom.has(stepKey)) {
        const parent = cameFrom.get(stepKey)!;
        path.push(parent);
        stepKey = nodeKey(parent);
      }

      path.reverse();
      return path;
    }

    open.delete(currentKey);
    closed.add(currentKey);

    for (const neighbor of neighbors(current, collisions, options)) {
      const nKey = nodeKey(neighbor);
      if (closed.has(nKey)) {
        continue;
      }

      points.set(nKey, neighbor);
      const moveCost = neighbor.x !== current.x && neighbor.y !== current.y ? Math.SQRT2 : 1;
      const tentativeG = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + moveCost;

      if (!open.has(nKey)) {
        open.add(nKey);
      } else if (tentativeG >= (gScore.get(nKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(nKey, current);
      gScore.set(nKey, tentativeG);
      fScore.set(nKey, tentativeG + euclidean(neighbor, goal));
    }
  }

  return [];
};
