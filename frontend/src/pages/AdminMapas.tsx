import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brush, Eraser, Hand, MapPinned, Minus, Plus, Target, Upload, ZoomIn } from "lucide-react";
import { ApiError } from "@/lib/api";
import { activateMap, createMap, getMapById, listMaps, saveMapAssets, saveMapLayout } from "@/lib/mapas";
import { GRID_COLS, GRID_ROWS, RENDER_BASE_HEIGHT, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "@/lib/map-grid";
import type { GameMap } from "@/types/mapa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EditorTab = "mapa_base" | "colisoes";
type EditorTool = "navigate" | "add" | "erase";
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

export const AdminMapasPage = () => {
  const [maps, setMaps] = useState<GameMap[]>([]);
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

  const [layoutDirty, setLayoutDirty] = useState(false);
  const [assetsDirty, setAssetsDirty] = useState(false);

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
  const hoverTileRef = useRef<{ x: number; y: number } | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const spacePressedRef = useRef(false);

  const saveStatusLabel = useMemo(() => {
    if (saveStatus === "saving") return "Salvando...";
    if (saveStatus === "saved") return "Salvo";
    if (saveStatus === "error") return "Erro ao salvar";
    return "Sem alteracoes pendentes";
  }, [saveStatus]);

  const refreshMaps = useCallback(async () => {
    const items = await listMaps();
    const detailed = await Promise.all(items.map((item) => getMapById(item.id)));
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
        await refreshMaps();
        if (!mounted) return;
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
        if (!mounted) return;
        setMapDraft(map);
        setLayoutDirty(false);
        setAssetsDirty(false);
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
  }, [selectedMapId]);

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
    if (!mapDraft || (!layoutDirty && !assetsDirty)) return;

    setSaveStatus("saving");
    const timeout = window.setTimeout(async () => {
      try {
        if (!mapDraft) return;

        if (assetsDirty) {
          await saveMapAssets(mapDraft.id, {
            backgroundImageData: mapDraft.backgroundImageData,
            tilePalette: mapDraft.tilePalette,
          });
        }

        if (layoutDirty) {
          await saveMapLayout(mapDraft.id, {
            tileLayer: mapDraft.tileLayer,
            collisionLayer: mapDraft.collisionLayer,
            spawnX: mapDraft.spawnX,
            spawnY: mapDraft.spawnY,
            backgroundScale: mapDraft.backgroundScale,
          });
        }

        setLayoutDirty(false);
        setAssetsDirty(false);
        setSaveStatus("saved");
        await refreshMaps();
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Falha ao salvar mapa automaticamente.");
        }
        setSaveStatus("error");
      }
    }, 700);

    return () => {
      clearTimeout(timeout);
    };
  }, [assetsDirty, layoutDirty, mapDraft, refreshMaps]);

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
        setTool("add");
      }
      if (event.key === "3") {
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
  }, [isCanvasFocused]);

  const updateMapDraft = (updater: (current: GameMap) => GameMap, markLayout: boolean, markAssets = false) => {
    setMapDraft((current) => {
      if (!current) return current;
      return updater(current);
    });
    if (markLayout) setLayoutDirty(true);
    if (markAssets) setAssetsDirty(true);
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
    if (tab !== "colisoes") return;

    const half = Math.floor(brushSize / 2);
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

      context.restore();
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [brushSize, mapDraft, tab, tool]);

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

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
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

              {tab === "mapa_base" ? (
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Mapa Base</p>
                  <p>Ajuste apenas a imagem (upload e escala), mantendo a grade fixa.</p>
                </div>
              ) : (
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
              )}

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

                  if (tab !== "colisoes" || !tile) return;
                  paintRef.current = true;
                  applyBrush(tile);
                }}
                onPointerMove={(event) => {
                  const tile = worldTileFromPointer(event);
                  hoverTileRef.current = tile;

                  if (dragRef.current.active) {
                    panRef.current.x = dragRef.current.panX + (event.clientX - dragRef.current.startX);
                    panRef.current.y = dragRef.current.panY + (event.clientY - dragRef.current.startY);
                  }

                  if (paintRef.current && tile && tab === "colisoes") {
                    applyBrush(tile);
                  }
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                  paintRef.current = false;
                }}
                onPointerLeave={() => {
                  dragRef.current.active = false;
                  paintRef.current = false;
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
