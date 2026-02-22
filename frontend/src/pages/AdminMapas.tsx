import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brush, Eraser, Hand, MapPinned, Minus, Plus, Target, Upload, ZoomIn } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listBestiaryAnimas } from "@/lib/bestiario";
import { activateMap, createMap, getMapById, listMaps, saveMapAssets, saveMapLayout } from "@/lib/mapas";
import { GRID_COLS, GRID_ROWS, RENDER_BASE_HEIGHT, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "@/lib/map-grid";
import type { GameMap } from "@/types/mapa";
import type { BestiaryAnima } from "@/types/bestiary-anima";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EditorTab = "mapa_base" | "colisoes" | "inimigos" | "portais";
type EditorTool = "navigate" | "add" | "erase";
type EnemyAreaMode = "spawn" | "movement";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const fileToDataUrl = async (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });

const cloneMatrix = <T,>(matrix: T[][]) => matrix.map((row) => [...row]);
const createEmptyBooleanLayer = () => Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => false));
const generateEnemySpawnId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `enemy_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const generatePortalId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `portal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const getEnemyColor = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    fill: `hsla(${hue}, 70%, 52%, 0.24)`,
    stroke: `hsla(${hue}, 88%, 65%, 0.85)`,
    subtle: `hsla(${hue}, 70%, 52%, 0.12)`,
  };
};

const normalizeMap = (map: GameMap): GameMap => ({
  ...map,
  enemySpawns: map.enemySpawns ?? [],
  portals: (map as { portals?: GameMap["portals"] }).portals ?? [],
});

export const AdminMapasPage = () => {
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [bestiaryAnimas, setBestiaryAnimas] = useState<BestiaryAnima[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapDraft, setMapDraft] = useState<GameMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newMapName, setNewMapName] = useState("");
  const [tab, setTab] = useState<EditorTab>("mapa_base");
  const [tool, setTool] = useState<EditorTool>("navigate");
  const [brushSize, setBrushSize] = useState(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [placingSpawn, setPlacingSpawn] = useState(false);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);
  const [selectedEnemySpawnId, setSelectedEnemySpawnId] = useState<string | null>(null);
  const [newEnemyBestiaryId, setNewEnemyBestiaryId] = useState<string>("");
  const [enemyAreaMode, setEnemyAreaMode] = useState<EnemyAreaMode>("spawn");
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [newPortalTargetMapId, setNewPortalTargetMapId] = useState<string>("");


  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panRef = useRef({ x: 20, y: 20 });
  const zoomRef = useRef(0.5);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });
  const paintRef = useRef(false);
  const lastPaintedTileKeyRef = useRef<string | null>(null);
  const hoverTileRef = useRef<{ x: number; y: number } | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const spacePressedRef = useRef(false);
  const mapDraftRef = useRef<GameMap | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const dirtyFlagsRef = useRef<{ layout: boolean; assets: boolean }>({ layout: false, assets: false });

  const saveStatusLabel = useMemo(() => {
    if (saveStatus === "saving") return "Salvando...";
    if (saveStatus === "saved") return "Salvo";
    if (saveStatus === "error") return "Erro ao salvar";
    return "Sem alteracoes pendentes";
  }, [saveStatus]);

  const refreshMaps = useCallback(async () => {
    const items = await listMaps();
    const detailedRaw = await Promise.all(items.map((item) => getMapById(item.id)));
    const detailed = detailedRaw.map(normalizeMap);
    setMaps(detailed);
    if (!selectedMapId && detailed.length > 0) {
      setSelectedMapId(detailed.find((item) => item.isActive)?.id ?? detailed[0].id);
    }
  }, [selectedMapId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [, bestiary] = await Promise.all([refreshMaps(), listBestiaryAnimas()]);
        if (!mounted) return;
        setBestiaryAnimas(bestiary);
        setNewEnemyBestiaryId((current) => current || bestiary[0]?.id || "");
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Nao foi possivel carregar os mapas.");
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
  }, [refreshMaps]);

  useEffect(() => {
    if (!selectedMapId) return;
    let mounted = true;
    const loadMap = async () => {
      try {
        const map = await getMapById(selectedMapId);
        const normalizedMap = normalizeMap(map);
        if (!mounted) return;
        setMapDraft(normalizedMap);
        setSelectedEnemySpawnId((current) => {
          if (current && normalizedMap.enemySpawns.some((item) => item.id === current)) {
            return current;
          }
          return normalizedMap.enemySpawns[0]?.id ?? null;
        });
        setSelectedPortalId((current) => {
          if (current && normalizedMap.portals.some((item) => item.id === current)) {
            return current;
          }
          return normalizedMap.portals[0]?.id ?? null;
        });
        setNewPortalTargetMapId((current) => {
          if (current) {
            return current;
          }
          const fallback = maps.find((item) => item.id !== normalizedMap.id) ?? null;
          return fallback?.id ?? "";
        });
        dirtyFlagsRef.current = { layout: false, assets: false };
        saveInFlightRef.current = false;
        queuedSaveRef.current = false;
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        setSaveStatus("idle");
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Falha ao carregar mapa.");
        }
      }
    };

    void loadMap();
    return () => {
      mounted = false;
    };
  }, [maps, selectedMapId]);

  useEffect(() => {
    if (!mapDraft?.backgroundImageData) {
      backgroundImageRef.current = null;
      return;
    }

    const image = new Image();
    image.src = mapDraft.backgroundImageData;
    backgroundImageRef.current = image;
  }, [mapDraft?.backgroundImageData]);

  useEffect(() => {
    mapDraftRef.current = mapDraft;
  }, [mapDraft]);

  useEffect(() => {
    if (!mapDraft || bestiaryAnimas.length === 0 || mapDraft.enemySpawns.length === 0) {
      return;
    }

    const bestiaryMap = new Map(bestiaryAnimas.map((item) => [item.id, item]));
    let changed = false;
    const hydrated = mapDraft.enemySpawns.map((group) => {
      const source = bestiaryMap.get(group.bestiaryAnimaId);
      if (!source) {
        return group;
      }

      const next = {
        ...group,
        bestiaryName: source.name ?? group.bestiaryName ?? null,
        imageData: source.imageData ?? group.imageData ?? null,
        spriteScale: source.spriteScale > 0 ? source.spriteScale : group.spriteScale > 0 ? group.spriteScale : 3,
        flipHorizontal: source.flipHorizontal ?? group.flipHorizontal ?? true,
        movementSpeed: group.movementSpeed > 0 ? group.movementSpeed : 2.2,
      };

      if (
        next.bestiaryName !== group.bestiaryName ||
        next.imageData !== group.imageData ||
        next.spriteScale !== group.spriteScale ||
        next.flipHorizontal !== group.flipHorizontal ||
        next.movementSpeed !== group.movementSpeed
      ) {
        changed = true;
      }
      return next;
    });

    if (!changed) {
      return;
    }

    setMapDraft((current) => (current ? { ...current, enemySpawns: hydrated } : current));
  }, [bestiaryAnimas, mapDraft]);

  const flushAutosave = useCallback(async () => {
    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    const snapshot = mapDraftRef.current;
    if (!snapshot) {
      return;
    }

    const shouldSaveLayout = dirtyFlagsRef.current.layout;
    const shouldSaveAssets = dirtyFlagsRef.current.assets;
    if (!shouldSaveLayout && !shouldSaveAssets) {
      return;
    }

    saveInFlightRef.current = true;
    queuedSaveRef.current = false;
    dirtyFlagsRef.current = { layout: false, assets: false };
    setSaveStatus("saving");

    try {
      if (shouldSaveAssets) {
        await saveMapAssets(snapshot.id, {
          backgroundImageData: snapshot.backgroundImageData,
          tilePalette: snapshot.tilePalette,
        });
      }

      if (shouldSaveLayout) {
        const compactEnemySpawns = snapshot.enemySpawns.map((group) => ({
          id: group.id,
          bestiaryAnimaId: group.bestiaryAnimaId,
          bestiaryName: group.bestiaryName ?? null,
          imageData: null,
          spriteScale: group.spriteScale,
          flipHorizontal: group.flipHorizontal,
          spawnCount: group.spawnCount,
          respawnSeconds: group.respawnSeconds,
          movementSpeed: group.movementSpeed,
          spawnArea: group.spawnArea,
          movementArea: group.movementArea,
        }));
        const compactPortals = snapshot.portals.map((portal) => ({
          id: portal.id,
          targetMapId: portal.targetMapId,
          targetMapName: portal.targetMapName ?? null,
          targetSpawnX: portal.targetSpawnX,
          targetSpawnY: portal.targetSpawnY,
          area: portal.area,
        }));
        await saveMapLayout(snapshot.id, {
          tileLayer: snapshot.tileLayer,
          collisionLayer: snapshot.collisionLayer,
          enemySpawns: compactEnemySpawns,
          portals: compactPortals,
          spawnX: snapshot.spawnX,
          spawnY: snapshot.spawnY,
          backgroundScale: snapshot.backgroundScale,
        });
      }

      setSaveStatus(dirtyFlagsRef.current.layout || dirtyFlagsRef.current.assets ? "saving" : "saved");
    } catch (error) {
      dirtyFlagsRef.current.layout ||= shouldSaveLayout;
      dirtyFlagsRef.current.assets ||= shouldSaveAssets;
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao salvar mapa automaticamente.");
      }
      setSaveStatus("error");
    } finally {
      saveInFlightRef.current = false;

      if (dirtyFlagsRef.current.layout || dirtyFlagsRef.current.assets || queuedSaveRef.current) {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = window.setTimeout(() => {
          void flushAutosave();
        }, 300);
      }
    }
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void flushAutosave();
    }, 450);
  }, [flushAutosave]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const container = editorSurfaceRef.current;
      if (!container) return;

      if (!container.contains(event.target as Node)) {
        setIsCanvasFocused(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.code === "Space") {
        if (!isCanvasFocused) return;
        event.preventDefault();
        spacePressedRef.current = true;
      }

      if (!isCanvasFocused) {
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        setTool("navigate");
      }
      if (event.key === "2") {
        event.preventDefault();
        if (tab === "inimigos") {
          setEnemyAreaMode("spawn");
          setTool("add");
        } else {
          setTool("add");
        }
      }
      if (event.key === "3") {
        event.preventDefault();
        if (tab === "inimigos") {
          setEnemyAreaMode("movement");
          setTool("add");
        } else {
          setTool("erase");
        }
      }
      if (event.key === "4" && tab === "inimigos") {
        event.preventDefault();
        setTool("erase");
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setTool("navigate");
        setPlacingSpawn(false);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressedRef.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isCanvasFocused, tab]);

  const updateMapDraft = (updater: (current: GameMap) => GameMap, markLayout: boolean, markAssets = false) => {
    setMapDraft((current) => {
      if (!current) return current;
      return updater(current);
    });
    if (markLayout) {
      dirtyFlagsRef.current.layout = true;
    }
    if (markAssets) {
      dirtyFlagsRef.current.assets = true;
    }
    if (markLayout || markAssets) {
      setSaveStatus("saving");
      scheduleAutosave();
    }
  };

  const selectedEnemySpawn = useMemo(
    () => mapDraft?.enemySpawns.find((item) => item.id === selectedEnemySpawnId) ?? null,
    [mapDraft?.enemySpawns, selectedEnemySpawnId],
  );

  const selectedPortal = useMemo(
    () => mapDraft?.portals.find((item) => item.id === selectedPortalId) ?? null,
    [mapDraft?.portals, selectedPortalId],
  );

  const availablePortalTargets = useMemo(
    () => maps.filter((item) => item.id !== mapDraft?.id),
    [mapDraft?.id, maps],
  );

  useEffect(() => {
    if (!availablePortalTargets.length) {
      setNewPortalTargetMapId("");
      return;
    }

    setNewPortalTargetMapId((current) => {
      if (current && availablePortalTargets.some((item) => item.id === current)) {
        return current;
      }
      return availablePortalTargets[0]?.id ?? "";
    });
  }, [availablePortalTargets]);

  const handleAddEnemySpawn = () => {
    if (!mapDraft || !newEnemyBestiaryId) {
      return;
    }

    const bestiary = bestiaryAnimas.find((item) => item.id === newEnemyBestiaryId);
    if (!bestiary) {
      return;
    }

    const nextConfig = {
      id: generateEnemySpawnId(),
      bestiaryAnimaId: bestiary.id,
      bestiaryName: bestiary.name,
      imageData: bestiary.imageData,
      spriteScale: bestiary.spriteScale ?? 3,
      flipHorizontal: bestiary.flipHorizontal ?? true,
      spawnCount: 3,
      respawnSeconds: 15,
      movementSpeed: 2.2,
      spawnArea: createEmptyBooleanLayer(),
      movementArea: createEmptyBooleanLayer(),
    };

    updateMapDraft(
      (current) => ({
        ...current,
        enemySpawns: [...current.enemySpawns, nextConfig],
      }),
      true,
    );
    setSelectedEnemySpawnId(nextConfig.id);
    setTool("add");
  };

  const handleRemoveEnemySpawn = (id: string) => {
    const remaining = (mapDraft?.enemySpawns ?? []).filter((item) => item.id !== id);
    updateMapDraft(
      (current) => ({
        ...current,
        enemySpawns: current.enemySpawns.filter((item) => item.id !== id),
      }),
      true,
    );
    setSelectedEnemySpawnId((current) => (current === id ? remaining[0]?.id ?? null : current));
  };

  const updateEnemySpawnConfig = (
    id: string,
    updater: (config: NonNullable<typeof selectedEnemySpawn>) => NonNullable<typeof selectedEnemySpawn>,
  ) => {
    updateMapDraft(
      (current) => ({
        ...current,
        enemySpawns: current.enemySpawns.map((item) => (item.id === id ? updater(item) : item)),
      }),
      true,
    );
  };

  const handleAddPortal = () => {
    if (!mapDraft) {
      return;
    }

    const targetMap = maps.find((item) => item.id === newPortalTargetMapId) ?? maps.find((item) => item.id !== mapDraft.id) ?? null;
    if (!targetMap) {
      return;
    }

    const nextPortal = {
      id: generatePortalId(),
      targetMapId: targetMap.id,
      targetMapName: targetMap.name,
      targetSpawnX: targetMap.spawnX,
      targetSpawnY: targetMap.spawnY,
      area: createEmptyBooleanLayer(),
    };

    updateMapDraft(
      (current) => ({
        ...current,
        portals: [...current.portals, nextPortal],
      }),
      true,
    );
    setSelectedPortalId(nextPortal.id);
    setTool("add");
  };

  const handleRemovePortal = (id: string) => {
    const remaining = (mapDraft?.portals ?? []).filter((item) => item.id !== id);
    updateMapDraft(
      (current) => ({
        ...current,
        portals: current.portals.filter((item) => item.id !== id),
      }),
      true,
    );
    setSelectedPortalId((current) => (current === id ? remaining[0]?.id ?? null : current));
  };

  const updatePortalConfig = (
    id: string,
    updater: (portal: NonNullable<typeof selectedPortal>) => NonNullable<typeof selectedPortal>,
  ) => {
    updateMapDraft(
      (current) => ({
        ...current,
        portals: current.portals.map((item) => (item.id === id ? updater(item) : item)),
      }),
      true,
    );
  };

  const worldTileFromPointer = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !mapDraft) return null;
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldX = (screenX - panRef.current.x) / zoomRef.current;
    const worldY = (screenY - panRef.current.y) / zoomRef.current;
    const x = Math.floor(worldX / TILE_SIZE);
    const y = Math.floor(worldY / TILE_SIZE);
    if (x < 0 || x >= mapDraft.cols || y < 0 || y >= mapDraft.rows) return null;
    return { x, y };
  };

  const applyBrush = (center: { x: number; y: number }) => {
    if (!mapDraft) return;
    if (tool === "navigate") return;
    const half = Math.floor(brushSize / 2);

    if (tab === "colisoes") {
      const willAdd = tool === "add";
      let shouldMutate = false;
      for (let dy = -half; dy <= half; dy += 1) {
        for (let dx = -half; dx <= half; dx += 1) {
          const x = center.x + dx;
          const y = center.y + dy;
          if (x < 0 || x >= mapDraft.cols || y < 0 || y >= mapDraft.rows) continue;
          if (mapDraft.collisionLayer[y]?.[x] !== willAdd) {
            shouldMutate = true;
            break;
          }
        }
        if (shouldMutate) break;
      }
      if (!shouldMutate) return;

      updateMapDraft(
        (current) => {
          const next = { ...current };
          const matrix = cloneMatrix(current.collisionLayer);
          for (let dy = -half; dy <= half; dy += 1) {
            for (let dx = -half; dx <= half; dx += 1) {
              const x = center.x + dx;
              const y = center.y + dy;
              if (x < 0 || x >= current.cols || y < 0 || y >= current.rows) continue;
              matrix[y][x] = tool === "add";
            }
          }
          next.collisionLayer = matrix;
          return next;
        },
        true,
      );
      return;
    }

    if (tab === "inimigos") {
      if (!selectedEnemySpawnId) {
        return;
      }
      const selectedConfig = mapDraft.enemySpawns.find((item) => item.id === selectedEnemySpawnId);
      if (!selectedConfig) {
        return;
      }
      let shouldMutate = false;
      for (let dy = -half; dy <= half; dy += 1) {
        for (let dx = -half; dx <= half; dx += 1) {
          const x = center.x + dx;
          const y = center.y + dy;
          if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
          if (tool === "erase") {
            if (selectedConfig.spawnArea[y]?.[x] || selectedConfig.movementArea[y]?.[x]) {
              shouldMutate = true;
              break;
            }
          } else if (enemyAreaMode === "spawn") {
            if (!selectedConfig.spawnArea[y]?.[x]) {
              shouldMutate = true;
              break;
            }
          } else if (!selectedConfig.movementArea[y]?.[x]) {
            shouldMutate = true;
            break;
          }
        }
        if (shouldMutate) break;
      }
      if (!shouldMutate) return;

      updateEnemySpawnConfig(selectedEnemySpawnId, (config) => {
        const nextSpawnArea = cloneMatrix(config.spawnArea);
        const nextMovementArea = cloneMatrix(config.movementArea);
        for (let dy = -half; dy <= half; dy += 1) {
          for (let dx = -half; dx <= half; dx += 1) {
            const x = center.x + dx;
            const y = center.y + dy;
            if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
            if (tool === "erase") {
              nextSpawnArea[y][x] = false;
              nextMovementArea[y][x] = false;
            } else if (enemyAreaMode === "spawn") {
              nextSpawnArea[y][x] = true;
            } else {
              nextMovementArea[y][x] = true;
            }
          }
        }

        return {
          ...config,
          spawnArea: nextSpawnArea,
          movementArea: nextMovementArea,
        };
      });
      return;
    }

    if (tab === "portais") {
      if (!selectedPortalId) {
        return;
      }
      const selectedPortalConfig = mapDraft.portals.find((item) => item.id === selectedPortalId);
      if (!selectedPortalConfig) {
        return;
      }
      const willAdd = tool === "add";
      let shouldMutate = false;
      for (let dy = -half; dy <= half; dy += 1) {
        for (let dx = -half; dx <= half; dx += 1) {
          const x = center.x + dx;
          const y = center.y + dy;
          if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
          if (selectedPortalConfig.area[y]?.[x] !== willAdd) {
            shouldMutate = true;
            break;
          }
        }
        if (shouldMutate) break;
      }
      if (!shouldMutate) return;

      updatePortalConfig(selectedPortalId, (portal) => {
        const nextArea = cloneMatrix(portal.area);
        for (let dy = -half; dy <= half; dy += 1) {
          for (let dx = -half; dx <= half; dx += 1) {
            const x = center.x + dx;
            const y = center.y + dy;
            if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
            nextArea[y][x] = tool === "add";
          }
        }

        return {
          ...portal,
          area: nextArea,
        };
      });
    }
  };

  const zoomTo = (nextZoom: number, anchorX?: number, anchorY?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ax = anchorX ?? rect.width / 2;
    const ay = anchorY ?? rect.height / 2;
    const beforeX = (ax - panRef.current.x) / zoomRef.current;
    const beforeY = (ay - panRef.current.y) / zoomRef.current;
    const clamped = clamp(nextZoom, 0.25, 3);
    zoomRef.current = clamped;
    panRef.current.x = ax - beforeX * clamped;
    panRef.current.y = ay - beforeY * clamped;
  };

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const map = mapDraft;
      if (!canvas || !map) {
        frame = requestAnimationFrame(draw);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      const neededW = Math.floor(width * dpr);
      const neededH = Math.floor(height * dpr);
      if (canvas.width !== neededW || canvas.height !== neededH) {
        canvas.width = neededW;
        canvas.height = neededH;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        frame = requestAnimationFrame(draw);
        return;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#0f0f0f";
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(panRef.current.x, panRef.current.y);
      context.scale(zoomRef.current, zoomRef.current);

      context.fillStyle = "#171717";
      context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      const bg = backgroundImageRef.current;
      if (bg?.complete) {
        const drawW = WORLD_WIDTH * map.backgroundScale;
        const drawH = RENDER_BASE_HEIGHT * map.backgroundScale;
        const drawX = (WORLD_WIDTH - drawW) / 2;
        const drawY = 4 + (RENDER_BASE_HEIGHT - drawH) / 2;
        context.drawImage(bg, drawX, drawY, drawW, drawH);
      }

      if (tab === "colisoes") {
        context.fillStyle = "rgba(220, 38, 38, 0.35)";
        for (let y = 0; y < map.rows; y += 1) {
          for (let x = 0; x < map.cols; x += 1) {
            if (!map.collisionLayer[y]?.[x]) continue;
            context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      if (tab === "inimigos") {
        for (const enemy of map.enemySpawns) {
          const colors = getEnemyColor(enemy.id);
          const isSelected = enemy.id === selectedEnemySpawnId;

          context.fillStyle = isSelected ? "rgba(56, 189, 248, 0.16)" : "rgba(56, 189, 248, 0.08)";
          for (let y = 0; y < map.rows; y += 1) {
            for (let x = 0; x < map.cols; x += 1) {
              if (!enemy.movementArea[y]?.[x]) continue;
              context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          }

          context.fillStyle = isSelected ? colors.fill : colors.subtle;
          for (let y = 0; y < map.rows; y += 1) {
            for (let x = 0; x < map.cols; x += 1) {
              if (!enemy.spawnArea[y]?.[x]) continue;
              context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          }

          if (isSelected) {
            context.strokeStyle = colors.stroke;
            context.lineWidth = 1;
            for (let y = 0; y < map.rows; y += 1) {
              for (let x = 0; x < map.cols; x += 1) {
                if (!enemy.spawnArea[y]?.[x]) continue;
                context.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
              }
            }
          }
        }
      }

      if (tab === "portais") {
        const now = performance.now();
        for (const portal of map.portals) {
          const isSelected = portal.id === selectedPortalId;
          const phase = (Math.sin(now / 260) + 1) * 0.5;
          const pulse = 0.4 + phase * 0.6;

          context.fillStyle = isSelected ? "rgba(99, 102, 241, 0.24)" : "rgba(99, 102, 241, 0.14)";
          context.strokeStyle = isSelected ? "rgba(129, 140, 248, 0.82)" : "rgba(129, 140, 248, 0.5)";
          context.lineWidth = 1;
          const portalCenters: Array<{ x: number; y: number }> = [];
          for (let y = 0; y < map.rows; y += 1) {
            for (let x = 0; x < map.cols; x += 1) {
              if (!portal.area[y]?.[x]) continue;
              const tileX = x * TILE_SIZE;
              const tileY = y * TILE_SIZE;
              context.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
              context.strokeRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
              portalCenters.push({ x: tileX + TILE_SIZE / 2, y: tileY + TILE_SIZE / 2 });
            }
          }

          context.save();
          context.setLineDash([5, 4]);
          context.lineDashOffset = -(now / 45);
          for (const center of portalCenters) {
            context.beginPath();
            context.strokeStyle = isSelected ? `rgba(129, 140, 248, ${0.46 + pulse * 0.38})` : `rgba(129, 140, 248, ${0.28 + pulse * 0.2})`;
            context.arc(center.x, center.y, 3.4 + pulse * 2.4, 0, Math.PI * 2);
            context.stroke();
          }
          context.restore();
        }
      }

      context.strokeStyle = "rgba(255,255,255,0.15)";
      context.lineWidth = 1;
      for (let x = 0; x <= GRID_COLS; x += 1) {
        context.beginPath();
        context.moveTo(x * TILE_SIZE, 0);
        context.lineTo(x * TILE_SIZE, WORLD_HEIGHT);
        context.stroke();
      }
      for (let y = 0; y <= GRID_ROWS; y += 1) {
        context.beginPath();
        context.moveTo(0, y * TILE_SIZE);
        context.lineTo(WORLD_WIDTH, y * TILE_SIZE);
        context.stroke();
      }

      context.fillStyle = "rgba(250, 204, 21, 0.85)";
      context.beginPath();
      context.arc(map.spawnX * TILE_SIZE + TILE_SIZE / 2, map.spawnY * TILE_SIZE + TILE_SIZE / 2, 8, 0, Math.PI * 2);
      context.fill();

      if (tab === "colisoes" && hoverTileRef.current && tool !== "navigate") {
        const half = Math.floor(brushSize / 2);
        context.fillStyle = tool === "add" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)";
        for (let dy = -half; dy <= half; dy += 1) {
          for (let dx = -half; dx <= half; dx += 1) {
            const x = hoverTileRef.current.x + dx;
            const y = hoverTileRef.current.y + dy;
            if (x < 0 || x >= map.cols || y < 0 || y >= map.rows) continue;
            context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      if (tab === "inimigos" && hoverTileRef.current && tool !== "navigate" && selectedEnemySpawnId) {
        const half = Math.floor(brushSize / 2);
        const selectedColors = getEnemyColor(selectedEnemySpawnId);
        context.fillStyle =
          tool === "erase"
            ? "rgba(239, 68, 68, 0.25)"
            : enemyAreaMode === "spawn"
              ? selectedColors.fill
              : "rgba(56, 189, 248, 0.22)";

        for (let dy = -half; dy <= half; dy += 1) {
          for (let dx = -half; dx <= half; dx += 1) {
            const x = hoverTileRef.current.x + dx;
            const y = hoverTileRef.current.y + dy;
            if (x < 0 || x >= map.cols || y < 0 || y >= map.rows) continue;
            context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      if (tab === "portais" && hoverTileRef.current && tool !== "navigate" && selectedPortalId) {
        const half = Math.floor(brushSize / 2);
        context.fillStyle = tool === "add" ? "rgba(129, 140, 248, 0.28)" : "rgba(239, 68, 68, 0.25)";
        for (let dy = -half; dy <= half; dy += 1) {
          for (let dx = -half; dx <= half; dx += 1) {
            const x = hoverTileRef.current.x + dx;
            const y = hoverTileRef.current.y + dy;
            if (x < 0 || x >= map.cols || y < 0 || y >= map.rows) continue;
            context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      context.restore();
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [brushSize, enemyAreaMode, mapDraft, selectedEnemySpawnId, selectedPortalId, tab, tool]);

  const handleCreateMap = async () => {
    if (newMapName.trim().length < 2) return;

    try {
      const created = await createMap(newMapName.trim());
      setNewMapName("");
      await refreshMaps();
      setSelectedMapId(created.id);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel criar mapa.");
      }
    }
  };

  const handleActivateMap = async () => {
    if (!mapDraft) return;

    try {
      await activateMap(mapDraft.id);
      await refreshMaps();
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao ativar mapa.");
      }
    }
  };

  const handleBackgroundUpload = async (file: File | null) => {
    if (!file || !mapDraft) return;

    const dataUrl = await fileToDataUrl(file);
    updateMapDraft((current) => ({ ...current, backgroundImageData: dataUrl }), false, true);
    setErrorMessage(null);
  };

  const activeMapName = maps.find((item) => item.id === selectedMapId)?.name ?? "-";
  const selectedPortalTargetMap = selectedPortal ? maps.find((item) => item.id === selectedPortal.targetMapId) ?? null : null;

  return (
    <section className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <MapPinned className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Administracao de mapas</p>
            <Badge variant="secondary">{saveStatusLabel}</Badge>
          </div>
          <CardTitle className="text-3xl tracking-tight">Editor de mapas</CardTitle>
          <CardDescription>Imagem base estatica + desenho de bloqueios com autosave.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <Input
              placeholder="Nome do novo mapa"
              value={newMapName}
              onChange={(event) => setNewMapName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreateMap();
                }
              }}
            />
            <Button className="gap-2" onClick={() => void handleCreateMap()}>
              <Plus className="h-4 w-4" />
              Criar mapa
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {maps.map((map) => (
              <Button
                key={map.id}
                variant={map.id === selectedMapId ? "default" : "outline"}
                className="gap-2"
                onClick={() => setSelectedMapId(map.id)}
              >
                {map.name}
                {map.isActive ? <Badge variant="secondary">Ativo</Badge> : null}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void handleActivateMap()} disabled={!mapDraft}>
              Ativar mapa selecionado
            </Button>
            <p className="text-xs text-muted-foreground">Mapa selecionado: {activeMapName}</p>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Carregando mapas...</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abas</CardTitle>
          <div className="flex gap-2">
            <Button variant={tab === "mapa_base" ? "default" : "outline"} onClick={() => setTab("mapa_base")}>
              Mapa Base
            </Button>
            <Button variant={tab === "colisoes" ? "default" : "outline"} onClick={() => setTab("colisoes")}>
              Colisoes
            </Button>
            <Button variant={tab === "inimigos" ? "default" : "outline"} onClick={() => setTab("inimigos")}>
              Inimigos
            </Button>
            <Button variant={tab === "portais" ? "default" : "outline"} onClick={() => setTab("portais")}>
              Portais
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tab === "colisoes" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={tool === "navigate" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("navigate")}>
                <Hand className="h-4 w-4" /> 1 Navegar
              </Button>
              <Button variant={tool === "add" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("add")}>
                <Brush className="h-4 w-4" /> 2 Adicionar bloqueio
              </Button>
              <Button variant={tool === "erase" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("erase")}>
                <Eraser className="h-4 w-4" /> 3 Apagar bloqueio
              </Button>
              <Badge variant="secondary">ESC volta para navegar</Badge>
            </div>
          ) : null}

          {tab === "inimigos" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={tool === "navigate" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("navigate")}>
                <Hand className="h-4 w-4" /> 1 Navegar
              </Button>
              <Button
                variant={tool === "add" && enemyAreaMode === "spawn" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEnemyAreaMode("spawn");
                  setTool("add");
                }}
              >
                <Brush className="h-4 w-4" /> 2 Desenhar Spawn
              </Button>
              <Button
                variant={tool === "add" && enemyAreaMode === "movement" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEnemyAreaMode("movement");
                  setTool("add");
                }}
              >
                <Brush className="h-4 w-4" /> 3 Desenhar Movimentacao
              </Button>
              <Button variant={tool === "erase" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("erase")}>
                <Eraser className="h-4 w-4" /> 4 Apagar
              </Button>
              <Badge variant="secondary">ESC volta para navegar</Badge>
            </div>
          ) : null}

          {tab === "portais" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={tool === "navigate" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("navigate")}>
                <Hand className="h-4 w-4" /> 1 Navegar
              </Button>
              <Button variant={tool === "add" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("add")}>
                <Brush className="h-4 w-4" /> 2 Desenhar portal
              </Button>
              <Button variant={tool === "erase" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTool("erase")}>
                <Eraser className="h-4 w-4" /> 3 Apagar portal
              </Button>
              <Badge variant="secondary">ESC volta para navegar</Badge>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              {tab === "mapa_base" ? (
                <>
                  <label className="block text-sm">
                    Escala da imagem base
                    <Input
                      type="number"
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={mapDraft?.backgroundScale ?? 1}
                      onChange={(event) =>
                        updateMapDraft(
                          (current) => ({ ...current, backgroundScale: clamp(Number(event.target.value) || 1, 0.1, 5) }),
                          true,
                        )
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    Upload imagem base
                    <Input type="file" accept="image/*" onChange={(event) => void handleBackgroundUpload(event.target.files?.[0] ?? null)} />
                  </label>

                  <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">Mapa Base</p>
                    <p>Ajuste apenas a imagem (upload e escala), mantendo a grade fixa.</p>
                  </div>
                </>
              ) : null}

              {tab === "colisoes" ? (
                <>
                  <label className="block text-sm">
                    Tamanho do pincel
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={brushSize}
                      onChange={(event) => setBrushSize(clamp(Number(event.target.value) || 1, 1, 5))}
                    />
                  </label>

                  <div className="space-y-3">
                    <Button
                      variant={placingSpawn ? "default" : "outline"}
                      className="w-full gap-2"
                      onClick={() => setPlacingSpawn((value) => !value)}
                    >
                      <Target className="h-4 w-4" />
                      {placingSpawn ? "Clique no mapa para definir spawn" : "Definir spawn por clique"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Adicionar/apagar afeta somente bloqueios de colisao.
                    </p>
                  </div>
                </>
              ) : null}

              {tab === "inimigos" ? (
                <div className="space-y-4">
                  <label className="block text-sm">
                    Tamanho do pincel
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={brushSize}
                      onChange={(event) => setBrushSize(clamp(Number(event.target.value) || 1, 1, 5))}
                    />
                  </label>

                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Adicionar inimigo</p>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={newEnemyBestiaryId}
                      onChange={(event) => setNewEnemyBestiaryId(event.target.value)}
                    >
                      <option value="">Selecione no bestiario</option>
                      {bestiaryAnimas.map((anima) => (
                        <option key={anima.id} value={anima.id}>
                          {anima.name}
                        </option>
                      ))}
                    </select>
                    <Button className="w-full" onClick={handleAddEnemySpawn} disabled={!newEnemyBestiaryId}>
                      Adicionar no mapa
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Grupos no mapa</p>
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {mapDraft?.enemySpawns.length ? (
                        mapDraft.enemySpawns.map((group) => {
                          const bestiary = bestiaryAnimas.find((item) => item.id === group.bestiaryAnimaId);
                          return (
                            <div
                              key={group.id}
                              className={`rounded-md border p-2 ${selectedEnemySpawnId === group.id ? "border-primary bg-primary/10" : "border-border"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <button type="button" className="flex items-center gap-2 text-left text-sm font-medium" onClick={() => setSelectedEnemySpawnId(group.id)}>
                                  {group.imageData ? (
                                    <img src={group.imageData} alt={bestiary?.name ?? group.bestiaryName ?? "Inimigo"} className="h-7 w-7 rounded border object-cover" />
                                  ) : (
                                    <div className="h-7 w-7 rounded border bg-muted" />
                                  )}
                                  <span>{bestiary?.name ?? group.bestiaryName ?? "Inimigo removido"}</span>
                                </button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveEnemySpawn(group.id)}>
                                  Remover
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Spawn {group.spawnCount} | Respawn {group.respawnSeconds}s | Vel. {(group.movementSpeed ?? 2.2).toFixed(1)} t/s
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhum grupo configurado.</p>
                      )}
                    </div>
                  </div>

                  {selectedEnemySpawn ? (
                    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                      <p className="text-sm font-medium">Configuracao do grupo</p>
                      <label className="block text-sm">
                        Quantidade de inimigos
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          step={1}
                          value={selectedEnemySpawn.spawnCount}
                          onChange={(event) => {
                            const next = clamp(Math.floor(Number(event.target.value) || 1), 1, 500);
                            updateEnemySpawnConfig(selectedEnemySpawn.id, (config) => ({ ...config, spawnCount: next }));
                          }}
                        />
                      </label>

                      <label className="block text-sm">
                        Tempo de respawn (segundos)
                        <Input
                          type="number"
                          min={0.5}
                          max={3600}
                          step={0.5}
                          value={selectedEnemySpawn.respawnSeconds}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            const next = clamp(Number.isFinite(parsed) ? parsed : 15, 0.5, 3600);
                            updateEnemySpawnConfig(selectedEnemySpawn.id, (config) => ({
                              ...config,
                              respawnSeconds: Number(next.toFixed(1)),
                            }));
                          }}
                        />
                      </label>

                      <label className="block text-sm">
                        Velocidade de movimentacao (tiles/segundo)
                        <Input
                          type="number"
                          min={0.25}
                          step={0.1}
                          value={selectedEnemySpawn.movementSpeed ?? 2.2}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            const next = Math.max(0.25, Number.isFinite(parsed) ? parsed : 2.2);
                            updateEnemySpawnConfig(selectedEnemySpawn.id, (config) => ({
                              ...config,
                              movementSpeed: Number(next.toFixed(2)),
                            }));
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <p>Selecione ou adicione um grupo de inimigos para desenhar as areas.</p>
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "portais" ? (
                <div className="space-y-4">
                  <label className="block text-sm">
                    Tamanho do pincel
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={brushSize}
                      onChange={(event) => setBrushSize(clamp(Number(event.target.value) || 1, 1, 5))}
                    />
                  </label>

                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Adicionar portal</p>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={newPortalTargetMapId}
                      onChange={(event) => setNewPortalTargetMapId(event.target.value)}
                    >
                      <option value="">Selecione o mapa de destino</option>
                      {availablePortalTargets.map((map) => (
                        <option key={map.id} value={map.id}>
                          {map.name}
                        </option>
                      ))}
                    </select>
                    <Button className="w-full" onClick={handleAddPortal} disabled={!newPortalTargetMapId}>
                      Adicionar portal
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Portais no mapa</p>
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {mapDraft?.portals.length ? (
                        mapDraft.portals.map((portal) => (
                          <div
                            key={portal.id}
                            className={`rounded-md border p-2 ${selectedPortalId === portal.id ? "border-primary bg-primary/10" : "border-border"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="text-left text-sm font-medium"
                                onClick={() => setSelectedPortalId(portal.id)}
                              >
                                Portal {portal.id.slice(0, 8)}
                              </button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemovePortal(portal.id)}>
                                Remover
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Destino: {maps.find((item) => item.id === portal.targetMapId)?.name ?? portal.targetMapName ?? "Mapa removido"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhum portal configurado.</p>
                      )}
                    </div>
                  </div>

                  {selectedPortal ? (
                    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                      <p className="text-sm font-medium">Configuracao do portal</p>
                      <label className="block text-sm">
                        Mapa de destino
                        <select
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          value={selectedPortal.targetMapId}
                          onChange={(event) => {
                            const target = maps.find((item) => item.id === event.target.value) ?? null;
                            if (!target) return;
                            updatePortalConfig(selectedPortal.id, (portal) => ({
                              ...portal,
                              targetMapId: target.id,
                              targetMapName: target.name,
                              targetSpawnX: target.spawnX,
                              targetSpawnY: target.spawnY,
                            }));
                          }}
                        >
                          {availablePortalTargets.map((map) => (
                            <option key={map.id} value={map.id}>
                              {map.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-sm">
                          Spawn X
                          <Input
                            type="number"
                            min={0}
                            max={GRID_COLS - 1}
                            step={1}
                            value={selectedPortal.targetSpawnX}
                            onChange={(event) =>
                              updatePortalConfig(selectedPortal.id, (portal) => ({
                                ...portal,
                                targetSpawnX: clamp(Math.floor(Number(event.target.value) || 0), 0, GRID_COLS - 1),
                              }))
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Spawn Y
                          <Input
                            type="number"
                            min={0}
                            max={GRID_ROWS - 1}
                            step={1}
                            value={selectedPortal.targetSpawnY}
                            onChange={(event) =>
                              updatePortalConfig(selectedPortal.id, (portal) => ({
                                ...portal,
                                targetSpawnY: clamp(Math.floor(Number(event.target.value) || 0), 0, GRID_ROWS - 1),
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className="rounded-md border bg-background p-2">
                        <p className="mb-2 text-xs font-medium text-foreground">Preview de destino</p>
                        <div className="relative h-36 overflow-hidden rounded border bg-black/30">
                          {selectedPortalTargetMap?.backgroundImageData ? (
                            <img
                              src={selectedPortalTargetMap.backgroundImageData}
                              alt={`Preview ${selectedPortalTargetMap.name}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Mapa sem imagem base</div>
                          )}
                          <div
                            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-100 bg-yellow-400/90 shadow-[0_0_10px_rgba(250,204,21,0.65)]"
                            style={{
                              left: `${((selectedPortal.targetSpawnX + 0.5) / GRID_COLS) * 100}%`,
                              top: `${((selectedPortal.targetSpawnY + 0.5) / GRID_ROWS) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Destino: ({selectedPortal.targetSpawnX}, {selectedPortal.targetSpawnY}) em {selectedPortalTargetMap?.name ?? selectedPortal.targetMapName ?? "-"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <p>Selecione um portal para editar destino e preview de spawn.</p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Pan/Zoom</p>
                <p className="mb-1">Clique no mapa para focar edicao.</p>
                <p className="mb-1">Com foco: scroll = zoom, Space + arrastar = mover.</p>
                <p>Fora do foco: scroll da pagina volta ao normal.</p>
              </div>
            </div>

            <div ref={editorSurfaceRef} className="rounded-md border bg-black/20 p-2">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Autosave ativo
                </span>
                <div className="inline-flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => zoomTo(zoomRef.current * 0.9)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="inline-flex items-center gap-1">
                    <ZoomIn className="h-3.5 w-3.5" />
                    Zoom {zoomRef.current.toFixed(2)}x
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => zoomTo(zoomRef.current * 1.1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <canvas
                ref={canvasRef}
                className={`h-[72vh] min-h-[460px] w-full rounded-md border bg-[#0e0e0e] ${
                  isCanvasFocused ? "border-primary" : "border-border"
                }`}
                style={{ touchAction: "none" }}
                onPointerDown={(event) => {
                  setIsCanvasFocused(true);
                  const tile = worldTileFromPointer(event);
                  hoverTileRef.current = tile;
                  lastPaintedTileKeyRef.current = null;
                  if (!mapDraft) return;

                  if (tool === "navigate" || event.button === 1 || event.shiftKey || spacePressedRef.current) {
                    dragRef.current = {
                      active: true,
                      startX: event.clientX,
                      startY: event.clientY,
                      panX: panRef.current.x,
                      panY: panRef.current.y,
                    };
                    return;
                  }

                  if (tab === "colisoes" && placingSpawn && tile) {
                    updateMapDraft((current) => ({ ...current, spawnX: tile.x, spawnY: tile.y }), true);
                    setPlacingSpawn(false);
                    return;
                  }

                  if (!tile || tab === "mapa_base") return;
                  if (tab === "inimigos" && !selectedEnemySpawnId) return;
                  if (tab === "portais" && !selectedPortalId) return;
                  paintRef.current = true;
                  lastPaintedTileKeyRef.current = `${tile.x}:${tile.y}`;
                  applyBrush(tile);
                }}
                onPointerMove={(event) => {
                  const tile = worldTileFromPointer(event);
                  hoverTileRef.current = tile;

                  if (dragRef.current.active) {
                    panRef.current.x = dragRef.current.panX + (event.clientX - dragRef.current.startX);
                    panRef.current.y = dragRef.current.panY + (event.clientY - dragRef.current.startY);
                  }

                  if (paintRef.current && tile && tab !== "mapa_base") {
                    const tileKey = `${tile.x}:${tile.y}`;
                    if (lastPaintedTileKeyRef.current === tileKey) {
                      return;
                    }
                    lastPaintedTileKeyRef.current = tileKey;
                    applyBrush(tile);
                  }
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                  paintRef.current = false;
                  lastPaintedTileKeyRef.current = null;
                }}
                onPointerLeave={() => {
                  dragRef.current.active = false;
                  paintRef.current = false;
                  lastPaintedTileKeyRef.current = null;
                  hoverTileRef.current = null;
                }}
                onWheel={(event) => {
                  if (!isCanvasFocused) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
                  const screenX = event.clientX - rect.left;
                  const screenY = event.clientY - rect.top;
                  const nextZoom = zoomRef.current * (event.deltaY < 0 ? 1.1 : 0.9);
                  zoomTo(nextZoom, screenX, screenY);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
