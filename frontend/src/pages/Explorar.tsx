import { useCallback, useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";
import { ApiError } from "@/lib/api";
import { listAdoptedAnimas } from "@/lib/adocoes";
import { findNearestWalkableTile, findPathAStar, RENDER_BASE_HEIGHT, TILE_SIZE } from "@/lib/map-grid";
import type { GridPoint } from "@/lib/map-grid";
import { getActiveMap, updateActiveState } from "@/lib/mapas";
import type { GameMap } from "@/types/mapa";
import { Badge } from "@/components/ui/badge";

type PlayerRuntime = {
  tileX: number;
  tileY: number;
  renderX: number;
  renderY: number;
  scaleX: number;
  scaleY: number;
  moving: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  moveStartedAt: number;
  moveDurationMs: number;
  facingX: -1 | 1;
};

type SpriteFrame = {
  canvas: HTMLCanvasElement;
  delayMs: number;
};

const getDataUrlMime = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase() ?? "image/png";
};

const dataUrlToBytes = (dataUrl: string) => {
  const base64Index = dataUrl.indexOf(",");
  const base64 = base64Index >= 0 ? dataUrl.slice(base64Index + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const keyToDirection: Record<string, GridPoint> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pointsEqual = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y;

export const ExplorarPage = () => {
  const [mapData, setMapData] = useState<GameMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const spriteImageRef = useRef<HTMLImageElement | null>(null);
  const spriteFramesRef = useRef<SpriteFrame[] | null>(null);
  const spriteAnimationRef = useRef({ index: 0, lastAt: 0, elapsed: 0 });
  const spriteBaseFlipRef = useRef(-1);
  const tileImageMapRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const routeRef = useRef<GridPoint[]>([]);
  const routeAllowsCornerCutRef = useRef(false);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const mouseHeldRef = useRef(false);
  const hoverTargetRef = useRef<GridPoint | null>(null);
  const navigationLayerCacheRef = useRef<{
    mapId: string | null;
    footprintWidthPx: number;
    layer: boolean[][];
  }>({
    mapId: null,
    footprintWidthPx: 0,
    layer: [],
  });
  const playerRef = useRef<PlayerRuntime>({
    tileX: 0,
    tileY: 0,
    renderX: 0,
    renderY: 0,
    scaleX: 3,
    scaleY: 3,
    moving: false,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    moveStartedAt: 0,
    moveDurationMs: 120,
    facingX: -1,
  });

  const [spriteData, setSpriteData] = useState<string | null>(null);

  const persistState = useCallback(async (tileX: number, tileY: number, scaleX: number, scaleY: number) => {
    try {
      await updateActiveState({ tileX, tileY, scaleX, scaleY });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao salvar estado de exploracao.");
      }
    }
  }, []);

  const getSpriteSourceSize = useCallback(() => {
    const frames = spriteFramesRef.current;
    if (frames && frames.length > 0) {
      const first = frames[0]?.canvas;
      if (first && first.width > 0 && first.height > 0) {
        return { width: first.width, height: first.height };
      }
    }

    const spriteImage = spriteImageRef.current;
    if (spriteImage && spriteImage.complete) {
      const width = spriteImage.naturalWidth || spriteImage.width;
      const height = spriteImage.naturalHeight || spriteImage.height;
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    return { width: TILE_SIZE, height: TILE_SIZE };
  }, []);

  const buildNavigationCollisionLayer = useCallback(
    (map: GameMap) => {
      const sourceSize = getSpriteSourceSize();
      const sourceMax = Math.max(sourceSize.width, sourceSize.height);
      const spriteBaseUnit = TILE_SIZE / sourceMax;
      const footprintWidthPx = Math.max(TILE_SIZE, sourceSize.width * spriteBaseUnit * playerRef.current.scaleX);
      const cache = navigationLayerCacheRef.current;

      if (cache.mapId === map.id && Math.abs(cache.footprintWidthPx - footprintWidthPx) < 0.001) {
        return cache.layer;
      }

      const navigationLayer: boolean[][] = Array.from({ length: map.rows }, () => Array.from({ length: map.cols }, () => false));
      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          const centerX = x * TILE_SIZE + TILE_SIZE / 2;
          const leftWorld = centerX - footprintWidthPx / 2 + 0.001;
          const rightWorld = centerX + footprintWidthPx / 2 - 0.001;
          const fromX = Math.floor(leftWorld / TILE_SIZE);
          const toX = Math.floor(rightWorld / TILE_SIZE);

          let blocked = fromX < 0 || toX >= map.cols;
          if (!blocked) {
            for (let footprintX = fromX; footprintX <= toX; footprintX += 1) {
              if (map.collisionLayer[y]?.[footprintX] === true) {
                blocked = true;
                break;
              }
            }
          }

          navigationLayer[y][x] = blocked;
        }
      }

      navigationLayerCacheRef.current = {
        mapId: map.id,
        footprintWidthPx,
        layer: navigationLayer,
      };
      return navigationLayer;
    },
    [getSpriteSourceSize],
  );

  const isWalkableForPlayer = useCallback(
    (map: GameMap, point: GridPoint, navigationLayer?: boolean[][]) => {
      const layer = navigationLayer ?? buildNavigationCollisionLayer(map);
      return point.x >= 0 && point.x < map.cols && point.y >= 0 && point.y < map.rows && layer[point.y]?.[point.x] !== true;
    },
    [buildNavigationCollisionLayer],
  );

  const resolvePointerDestination = useCallback(
    (target: GridPoint | null): GridPoint | null => {
      if (!mapData || !target) {
        return null;
      }
      const navigationLayer = buildNavigationCollisionLayer(mapData);
      return isWalkableForPlayer(mapData, target, navigationLayer) ? target : findNearestWalkableTile(target, navigationLayer);
    },
    [buildNavigationCollisionLayer, isWalkableForPlayer, mapData],
  );

  const recalculatePath = useCallback(
    (target: GridPoint | null) => {
      if (!mapData || !target) {
        routeRef.current = [];
        routeAllowsCornerCutRef.current = false;
        return;
      }

      const start = { x: playerRef.current.tileX, y: playerRef.current.tileY };
      const navigationLayer = buildNavigationCollisionLayer(mapData);
      const destination = resolvePointerDestination(target);
      if (!destination) {
        routeRef.current = [];
        routeAllowsCornerCutRef.current = false;
        return;
      }

      // Permite sair de uma posicao inicial comprometida sem travar o pathfinding.
      const pathLayer = navigationLayer.map((row) => row.slice());
      if (start.y >= 0 && start.y < mapData.rows && start.x >= 0 && start.x < mapData.cols) {
        pathLayer[start.y][start.x] = false;
      }

      const path = findPathAStar(start, destination, pathLayer, { allowCornerCut: true });
      routeRef.current = path.length > 1 ? path.slice(1) : [];
      routeAllowsCornerCutRef.current = routeRef.current.length > 0;
    },
    [buildNavigationCollisionLayer, mapData, resolvePointerDestination],
  );

  const pointerToTile = useCallback(
    (event: { clientX: number; clientY: number }): GridPoint | null => {
      const canvas = canvasRef.current;
      if (!canvas || !mapData) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const worldX = cameraRef.current.x + (event.clientX - rect.left);
      const worldY = cameraRef.current.y + (event.clientY - rect.top);
      const tileX = Math.floor(worldX / TILE_SIZE);
      const tileY = Math.floor(worldY / TILE_SIZE);

      if (tileX < 0 || tileX >= mapData.cols || tileY < 0 || tileY >= mapData.rows) {
        return null;
      }

      return { x: tileX, y: tileY };
    },
    [mapData],
  );

  const tryStartMove = useCallback(
    (target: GridPoint, options?: { allowCornerCut?: boolean }) => {
      const map = mapData;
      if (!map) return false;
      const navigationLayer = buildNavigationCollisionLayer(map);
      if (!isWalkableForPlayer(map, target, navigationLayer)) return false;

      const current = { x: playerRef.current.tileX, y: playerRef.current.tileY };
      const dx = target.x - current.x;
      const dy = target.y - current.y;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        return false;
      }

      if (dx !== 0 && dy !== 0 && options?.allowCornerCut !== true) {
        const sideA = { x: current.x + dx, y: current.y };
        const sideB = { x: current.x, y: current.y + dy };
        if (!isWalkableForPlayer(map, sideA, navigationLayer) || !isWalkableForPlayer(map, sideB, navigationLayer)) {
          return false;
        }
      }

      playerRef.current.moving = true;
      playerRef.current.fromX = current.x;
      playerRef.current.fromY = current.y;
      playerRef.current.toX = target.x;
      playerRef.current.toY = target.y;
      if (dx > 0) {
        playerRef.current.facingX = 1;
      } else if (dx < 0) {
        playerRef.current.facingX = -1;
      }
      playerRef.current.moveStartedAt = performance.now();
      playerRef.current.moveDurationMs = 120;
      return true;
    },
    [buildNavigationCollisionLayer, isWalkableForPlayer, mapData],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [active, adopted] = await Promise.all([getActiveMap(), listAdoptedAnimas()]);
        if (!mounted) return;

        setMapData(active.map);
        playerRef.current.tileX = active.state.tileX;
        playerRef.current.tileY = active.state.tileY;
        playerRef.current.renderX = active.state.tileX;
        playerRef.current.renderY = active.state.tileY;
        const primary = adopted.find((item) => item.isPrimary) ?? null;
        const hasAnimaScale = typeof primary?.baseAnima.spriteScale === "number";
        const animaScale = Math.max(primary?.baseAnima.spriteScale ?? 3, 0.1);
        const initialScaleX = hasAnimaScale ? animaScale : active.state.scaleX;
        const initialScaleY = hasAnimaScale ? animaScale : active.state.scaleY;

        playerRef.current.scaleX = initialScaleX;
        playerRef.current.scaleY = initialScaleY;
        spriteBaseFlipRef.current = primary?.baseAnima.flipHorizontal === false ? 1 : -1;
        setSpriteData(primary?.baseAnima.imageData ?? null);

        if (initialScaleX !== active.state.scaleX || initialScaleY !== active.state.scaleY) {
          await updateActiveState({
            tileX: active.state.tileX,
            tileY: active.state.tileY,
            scaleX: initialScaleX,
            scaleY: initialScaleY,
          });
        }

        setErrorMessage(null);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Nao foi possivel carregar o mapa ativo.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapData?.backgroundImageData) {
      backgroundImageRef.current = null;
      return;
    }

    const image = new Image();
    image.src = mapData.backgroundImageData;
    backgroundImageRef.current = image;
  }, [mapData?.backgroundImageData]);

  useEffect(() => {
    if (!spriteData) {
      spriteImageRef.current = null;
      spriteFramesRef.current = null;
      spriteAnimationRef.current = { index: 0, lastAt: 0, elapsed: 0 };
      return;
    }

    const mimeType = getDataUrlMime(spriteData);
    if (mimeType.includes("gif")) {
      try {
        const sourceBytes = dataUrlToBytes(spriteData);
        const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
        const parsed = parseGIF(sourceBuffer);
        const frames = decompressFrames(parsed, true) as ParsedFrame[];
        const width = parsed.lsd.width;
        const height = parsed.lsd.height;

        const compositionCanvas = document.createElement("canvas");
        compositionCanvas.width = width;
        compositionCanvas.height = height;
        const compositionContext = compositionCanvas.getContext("2d", { willReadFrequently: true });
        if (!compositionContext || frames.length === 0) {
          spriteFramesRef.current = null;
          spriteImageRef.current = null;
          return;
        }

        const composedFrames: SpriteFrame[] = [];
        for (const frame of frames) {
          let restoreSnapshot: ImageData | null = null;
          if (frame.disposalType === 3) {
            restoreSnapshot = compositionContext.getImageData(0, 0, width, height);
          }

          const patchImageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
          compositionContext.putImageData(patchImageData, frame.dims.left, frame.dims.top);

          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = width;
          frameCanvas.height = height;
          const frameContext = frameCanvas.getContext("2d");
          if (!frameContext) {
            continue;
          }
          frameContext.drawImage(compositionCanvas, 0, 0);
          composedFrames.push({ canvas: frameCanvas, delayMs: Math.max(20, frame.delay || 80) });

          if (frame.disposalType === 2) {
            compositionContext.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
          } else if (frame.disposalType === 3 && restoreSnapshot) {
            compositionContext.putImageData(restoreSnapshot, 0, 0);
          }
        }

        spriteFramesRef.current = composedFrames.length > 0 ? composedFrames : null;
        spriteImageRef.current = null;
        spriteAnimationRef.current = { index: 0, lastAt: 0, elapsed: 0 };
      } catch {
        spriteFramesRef.current = null;
        const fallbackImage = new Image();
        fallbackImage.src = spriteData;
        spriteImageRef.current = fallbackImage;
      }
      return;
    }

    spriteFramesRef.current = null;
    const image = new Image();
    image.src = spriteData;
    spriteImageRef.current = image;
    spriteAnimationRef.current = { index: 0, lastAt: 0, elapsed: 0 };
  }, [spriteData]);

  useEffect(() => {
    if (!mapData) {
      tileImageMapRef.current = new Map();
      return;
    }

    const map = new Map<number, HTMLImageElement>();
    mapData.tilePalette.forEach((asset, index) => {
      const image = new Image();
      image.src = asset.imageData;
      map.set(index, image);
    });

    tileImageMapRef.current = map;
  }, [mapData]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!keyToDirection[key]) return;
      event.preventDefault();
      heldKeysRef.current.add(key);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      heldKeysRef.current.delete(key);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const map = mapData;
      if (!canvas || !map) {
        frame = requestAnimationFrame(draw);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      const neededWidth = Math.floor(width * dpr);
      const neededHeight = Math.floor(height * dpr);

      if (canvas.width !== neededWidth || canvas.height !== neededHeight) {
        canvas.width = neededWidth;
        canvas.height = neededHeight;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        frame = requestAnimationFrame(draw);
        return;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const now = performance.now();
      let moveT = 0;
      if (playerRef.current.moving) {
        const elapsed = now - playerRef.current.moveStartedAt;
        const t = clamp(elapsed / playerRef.current.moveDurationMs, 0, 1);
        moveT = t;
        playerRef.current.renderX = playerRef.current.fromX + (playerRef.current.toX - playerRef.current.fromX) * t;
        playerRef.current.renderY = playerRef.current.fromY + (playerRef.current.toY - playerRef.current.fromY) * t;

        if (t >= 1) {
          playerRef.current.moving = false;
          playerRef.current.tileX = playerRef.current.toX;
          playerRef.current.tileY = playerRef.current.toY;
          playerRef.current.renderX = playerRef.current.toX;
          playerRef.current.renderY = playerRef.current.toY;
          void persistState(
            playerRef.current.tileX,
            playerRef.current.tileY,
            playerRef.current.scaleX,
            playerRef.current.scaleY,
          );
        }
      }

      if (!playerRef.current.moving) {
        if (routeRef.current.length > 0) {
          const next = routeRef.current.shift();
          if (next) {
            const started = tryStartMove(next, { allowCornerCut: routeAllowsCornerCutRef.current });
            if (!started) {
              routeRef.current = [];
              routeAllowsCornerCutRef.current = false;
            }
          } else {
            routeAllowsCornerCutRef.current = false;
          }
        } else {
          routeAllowsCornerCutRef.current = false;
          let dx = 0;
          let dy = 0;
          for (const key of heldKeysRef.current) {
            const dir = keyToDirection[key];
            if (!dir) continue;
            dx += dir.x;
            dy += dir.y;
          }

          dx = Math.sign(dx);
          dy = Math.sign(dy);
          if (dx !== 0 || dy !== 0) {
            const next = { x: playerRef.current.tileX + dx, y: playerRef.current.tileY + dy };
            if (tryStartMove(next)) {
              routeRef.current = [];
              routeAllowsCornerCutRef.current = false;
            }
          }
        }
      }

      const playerWorldX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
      const playerWorldY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE / 2;
      const maxCameraX = Math.max(0, map.worldWidth - width);
      const maxCameraY = Math.max(0, map.worldHeight - height);
      const cameraX = clamp(playerWorldX - width / 2, 0, maxCameraX);
      const cameraY = clamp(playerWorldY - height / 2, 0, maxCameraY);
      cameraRef.current = { x: cameraX, y: cameraY, width, height };

      context.fillStyle = "rgba(15, 15, 15, 1)";
      context.fillRect(0, 0, width, height);
      context.save();
      context.translate(-cameraX, -cameraY);

      context.fillStyle = "#161616";
      context.fillRect(0, 0, map.worldWidth, map.worldHeight);

      const bgImage = backgroundImageRef.current;
      if (bgImage?.complete && map.backgroundScale > 0) {
        const drawWidth = map.worldWidth * map.backgroundScale;
        const drawHeight = RENDER_BASE_HEIGHT * map.backgroundScale;
        const drawX = (map.worldWidth - drawWidth) / 2;
        const drawY = 4 + (RENDER_BASE_HEIGHT - drawHeight) / 2;
        context.drawImage(bgImage, drawX, drawY, drawWidth, drawHeight);
      }

      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          const tileIndex = map.tileLayer[y]?.[x];
          if (tileIndex === null || tileIndex === undefined) {
            continue;
          }

          const tileImage = tileImageMapRef.current.get(tileIndex);
          if (tileImage?.complete) {
            context.drawImage(tileImage, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      const hoverTile = resolvePointerDestination(hoverTargetRef.current);
      if (hoverTile) {
        const tileX = hoverTile.x * TILE_SIZE;
        const tileY = hoverTile.y * TILE_SIZE;
        context.fillStyle = "rgba(226, 232, 240, 0.08)";
        context.fillRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        context.strokeStyle = "rgba(226, 232, 240, 0.18)";
        context.lineWidth = 1;
        context.strokeRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }

      if (routeRef.current.length > 0) {
        context.strokeStyle = "rgba(226, 232, 240, 0.5)";
        context.lineWidth = 1.75;
        context.setLineDash([7, 10]);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2, playerRef.current.renderY * TILE_SIZE + TILE_SIZE / 2);
        for (const point of routeRef.current) {
          context.lineTo(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2);
        }
        context.stroke();
        context.setLineDash([]);

        context.fillStyle = "rgba(148, 163, 184, 0.55)";
        for (const point of routeRef.current) {
          context.beginPath();
          context.arc(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2, 1.8, 0, Math.PI * 2);
          context.fill();
        }

        const last = routeRef.current[routeRef.current.length - 1];
        if (last) {
          const tileX = last.x * TILE_SIZE;
          const tileY = last.y * TILE_SIZE;
          context.fillStyle = "rgba(226, 232, 240, 0.08)";
          context.fillRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
          context.strokeStyle = "rgba(226, 232, 240, 0.82)";
          context.lineWidth = 1.35;
          context.strokeRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      }

      let sprite: CanvasImageSource | null = spriteImageRef.current;
      const spriteFrames = spriteFramesRef.current;
      if (spriteFrames && spriteFrames.length > 0) {
        if (spriteAnimationRef.current.lastAt === 0) {
          spriteAnimationRef.current.lastAt = now;
        }

        const delta = now - spriteAnimationRef.current.lastAt;
        spriteAnimationRef.current.lastAt = now;
        spriteAnimationRef.current.elapsed += delta;

        let current = spriteFrames[spriteAnimationRef.current.index] ?? spriteFrames[0];
        while (spriteAnimationRef.current.elapsed >= current.delayMs) {
          spriteAnimationRef.current.elapsed -= current.delayMs;
          spriteAnimationRef.current.index = (spriteAnimationRef.current.index + 1) % spriteFrames.length;
          current = spriteFrames[spriteAnimationRef.current.index] ?? spriteFrames[0];
        }

        sprite = current.canvas;
      }
      const spriteSourceWidth =
        sprite && "width" in sprite && typeof sprite.width === "number" && sprite.width > 0 ? sprite.width : TILE_SIZE;
      const spriteSourceHeight =
        sprite && "height" in sprite && typeof sprite.height === "number" && sprite.height > 0 ? sprite.height : TILE_SIZE;
      const spriteBaseUnit = TILE_SIZE / Math.max(spriteSourceWidth, spriteSourceHeight);
      const spriteBaseWidth = spriteSourceWidth * spriteBaseUnit * playerRef.current.scaleX;
      const spriteBaseHeight = spriteSourceHeight * spriteBaseUnit * playerRef.current.scaleY;
      const centerX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
      const baseY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE;
      const moveWave = Math.sin(moveT * Math.PI);
      const bobY = playerRef.current.moving ? Math.abs(moveWave) * 2.2 : 0;
      const shadowPulse = playerRef.current.moving ? Math.abs(moveWave) * 0.05 : 0;

      context.fillStyle = `rgba(0, 0, 0, ${0.22 + shadowPulse})`;
      context.beginPath();
      context.ellipse(
        centerX,
        baseY - 2,
        (spriteBaseWidth * (0.22 - shadowPulse * 0.4)) / 2,
        (TILE_SIZE * 0.22) / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();

      context.save();
      context.translate(centerX, baseY - bobY);
      context.scale(playerRef.current.facingX * spriteBaseFlipRef.current, 1);
      if (sprite) {
        context.drawImage(sprite, -spriteBaseWidth / 2, -spriteBaseHeight, spriteBaseWidth, spriteBaseHeight);
      } else {
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(0, -spriteBaseHeight / 2, 10, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      context.restore();
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [mapData, persistState, tryStartMove]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <Compass className="h-4 w-4" />
        <p className="text-xs uppercase tracking-wide">Explorar</p>
        <Badge variant="secondary">{mapData?.name ?? "Mapa ativo"}</Badge>
      </div>

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Carregando mapa...</p> : null}

      <canvas
        ref={canvasRef}
        className="h-[74vh] min-h-[520px] w-full rounded-md border bg-black/30"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          mouseHeldRef.current = true;
          const point = pointerToTile(event);
          hoverTargetRef.current = point;
          recalculatePath(point);
        }}
        onPointerMove={(event) => {
          const point = pointerToTile(event);
          if (!point) {
            hoverTargetRef.current = null;
            return;
          }
          if (hoverTargetRef.current && pointsEqual(hoverTargetRef.current, point)) return;
          hoverTargetRef.current = point;
          if (mouseHeldRef.current) {
            recalculatePath(point);
          }
        }}
        onPointerUp={() => {
          mouseHeldRef.current = false;
        }}
        onPointerLeave={() => {
          mouseHeldRef.current = false;
          hoverTargetRef.current = null;
        }}
      />
    </section>
  );
};
