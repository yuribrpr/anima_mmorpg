import { findNearestWalkableTile, findPathAStar } from "@/lib/map-grid";

const emptyCollision = () => Array.from({ length: 34 }, () => Array.from({ length: 60 }, () => false));

describe("map-grid A*", () => {
  it("finds a direct diagonal path when unobstructed", () => {
    const collisions = emptyCollision();
    const path = findPathAStar({ x: 1, y: 1 }, { x: 3, y: 3 }, collisions);

    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 1, y: 1 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });
  });

  it("prevents diagonal corner cutting", () => {
    const collisions = emptyCollision();
    collisions[0][1] = true;
    collisions[1][0] = true;

    const path = findPathAStar({ x: 0, y: 0 }, { x: 1, y: 1 }, collisions);
    expect(path).toEqual([]);
  });

  it("allows corner cutting when option is enabled", () => {
    const collisions = emptyCollision();
    collisions[0][1] = true;
    collisions[1][0] = true;

    const path = findPathAStar({ x: 0, y: 0 }, { x: 1, y: 1 }, collisions, { allowCornerCut: true });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 1, y: 1 });
  });

  it("finds nearest walkable tile when target is blocked", () => {
    const collisions = emptyCollision();
    collisions[10][10] = true;
    const nearest = findNearestWalkableTile({ x: 10, y: 10 }, collisions);

    expect(nearest).not.toBeNull();
    expect(collisions[nearest!.y][nearest!.x]).toBe(false);
  });
});
