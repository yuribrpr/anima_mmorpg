import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Compass, GripVertical, ShoppingBag, Wrench } from "lucide-react";
import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";
import { ApiError } from "@/lib/api";
import { listAdoptedAnimas } from "@/lib/adocoes";
import { listBestiaryAnimas } from "@/lib/bestiario";
import { collectInventoryDrop } from "@/lib/inventario";
import { listItems } from "@/lib/itens";
import { findNearestWalkableTile, findPathAStar, RENDER_BASE_HEIGHT, TILE_SIZE } from "@/lib/map-grid";
import type { GridPoint } from "@/lib/map-grid";
import { getActiveMap, listActivePlayers, updateActiveState, usePortal } from "@/lib/mapas";
import { acceptNpcQuest, buyFromNpc, craftAtNpc, deliverNpcQuest, listActiveMapNpcs, listPlayerQuests, registerEnemyDefeat, registerNpcTalk } from "@/lib/npcs";
import { cn } from "@/lib/utils";
import type { GameMap } from "@/types/mapa";
import type { BestiaryAnima } from "@/types/bestiary-anima";
import type { ActiveMapNpc, NpcDialog, NpcShopBuyOffer, NpcShopCraftRecipe, PlayerQuest, QuestType } from "@/types/npc";
import type { Item } from "@/types/item";
import type { AdoptedAnima } from "@/types/adocao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingBagMenu } from "@/components/layout/FloatingBagMenu";

type PlayerRuntime = {
  animaName: string;
  level: number;
  experience: number;
  experienceMax: number;
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
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  critChance: number;
  attackIntervalMs: number;
  lastAttackAt: number;
  hitFlashUntil: number;
  attackLungeUntil: number;
  attackLungeDx: number;
  attackLungeDy: number;
  attackLungeDistance: number;
  trackingEnemyId: string | null;
  nextTrackingPathAt: number;
};

type SpriteFrame = {
  canvas: HTMLCanvasElement;
  delayMs: number;
};

type SpriteAnimationState = {
  index: number;
  lastAt: number;
  elapsed: number;
};

type SpriteAsset = {
  image: HTMLImageElement | null;
  frames: SpriteFrame[] | null;
  animation: SpriteAnimationState;
};

type EnemyGroupRuntime = {
  id: string;
  bestiaryAnimaId: string;
  name: string;
  respawnMs: number;
  movementSpeed: number;
  attack: number;
  defense: number;
  maxHp: number;
  critChance: number;
  attackIntervalMs: number;
  spawnArea: boolean[][];
  movementArea: boolean[][];
  movementCollisionLayer: boolean[][];
  spawnTiles: GridPoint[];
  movementTiles: GridPoint[];
  spriteScale: number;
  flipHorizontal: boolean;
};

type EnemyRuntime = {
  id: string;
  groupId: string;
  tileX: number;
  tileY: number;
  renderX: number;
  renderY: number;
  moving: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  moveStartedAt: number;
  moveDurationMs: number;
  route: GridPoint[];
  facingX: -1 | 1;
  spawned: boolean;
  respawnAt: number;
  nextDecisionAt: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  critChance: number;
  attackIntervalMs: number;
  lastAttackAt: number;
  hitFlashUntil: number;
  attackLungeUntil: number;
  attackLungeDx: number;
  attackLungeDy: number;
  attackLungeDistance: number;
  deathStartedAt: number;
  spawnFxUntil: number;
  aggroUntilAt: number;
};

type DamageText = {
  id: string;
  x: number;
  y: number;
  value: number;
  createdAt: number;
  ttlMs: number;
  critical: boolean;
  fromEnemy: boolean;
};

type RewardFloatingText = {
  id: string;
  x: number;
  y: number;
  text: string;
  createdAt: number;
  ttlMs: number;
  color: string;
  scale: number;
};

type AttackEffect = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  createdAt: number;
  ttlMs: number;
  fromEnemy: boolean;
  critical: boolean;
};

type ImpactParticle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  createdAt: number;
  ttlMs: number;
  size: number;
  color: string;
  glow: boolean;
  gravity: number;
};

type ImpactRing = {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  ttlMs: number;
  color: string;
  critical: boolean;
};

type GroundDrop = {
  id: string;
  itemId: string;
  itemName: string;
  imageData: string | null;
  quantity: number;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  spawnedAt: number;
  expiresAt: number;
  collecting: boolean;
};

type PortalPromptState = {
  portalId: string;
  targetMapName: string;
  targetSpawnX: number;
  targetSpawnY: number;
};

type OtherPlayerRuntime = {
  userId: string;
  username: string;
  animaName: string;
  animaLevel: number;
  animaImageData: string | null;
  animaFlipHorizontal: boolean;
  animaSpriteScale: number;
  tileX: number;
  tileY: number;
  scaleX: number;
  scaleY: number;
  facingX: -1 | 1;
  updatedAtMs: number;
};

type NpcInteractionState = {
  npc: ActiveMapNpc;
};

type NpcConversationState = {
  npc: ActiveMapNpc;
  dialogs: NpcDialog[];
  index: number;
  questAction: {
    mode: "accept" | "deliver";
    questId: string | null;
  };
};

type NpcShopState = {
  npcId: string;
  dialogId: string;
  dialog: NpcDialog;
};

type NpcInteractionQuestEntry = {
  dialog: NpcDialog;
  questType: QuestType;
  mode: "accept" | "deliver";
  questId: string | null;
  title: string;
};

type EvolutionVfxState = {
  active: boolean;
  tone: "evolved" | "regressed";
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

const decodeGifFrames = (dataUrl: string): SpriteFrame[] | null => {
  const sourceBytes = dataUrlToBytes(dataUrl);
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
    return null;
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

  return composedFrames.length > 0 ? composedFrames : null;
};

const createSpriteAsset = (dataUrl: string): SpriteAsset => {
  const animation: SpriteAnimationState = { index: 0, lastAt: 0, elapsed: 0 };
  const mimeType = getDataUrlMime(dataUrl);
  if (mimeType.includes("gif")) {
    try {
      const frames = decodeGifFrames(dataUrl);
      if (frames && frames.length > 0) {
        return { image: null, frames, animation };
      }
    } catch {
      // Fallback below for malformed GIF payload.
    }
  }

  const image = new Image();
  image.src = dataUrl;
  return { image, frames: null, animation };
};

const resolveSpriteFrame = (frames: SpriteFrame[] | null, animation: SpriteAnimationState, now: number): CanvasImageSource | null => {
  if (!frames || frames.length === 0) {
    return null;
  }

  if (animation.lastAt === 0) {
    animation.lastAt = now;
  }

  const delta = now - animation.lastAt;
  animation.lastAt = now;
  animation.elapsed += delta;

  let current = frames[animation.index] ?? frames[0];
  while (animation.elapsed >= current.delayMs) {
    animation.elapsed -= current.delayMs;
    animation.index = (animation.index + 1) % frames.length;
    current = frames[animation.index] ?? frames[0];
  }

  return current.canvas;
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
const enemyDirections: GridPoint[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const questTypeVisualMap: Record<QuestType, { label: string; color: string; textColor: string }> = {
  MAIN: { label: "Main Quest", color: "#a855f7", textColor: "#f3e8ff" },
  SUB: { label: "Subquest", color: "#eab308", textColor: "#fef9c3" },
  DAILY: { label: "Daily Quest", color: "#3b82f6", textColor: "#dbeafe" },
  REPEATABLE: { label: "Repetivel", color: "#22c55e", textColor: "#dcfce7" },
};

const normalizeQuestType = (value: unknown): QuestType => {
  if (value === "MAIN" || value === "SUB" || value === "DAILY" || value === "REPEATABLE") {
    return value;
  }
  return "SUB";
};

const getQuestObjectiveLabel = (objective: PlayerQuest["objectives"][number]) => {
  if (objective.type === "TALK") {
    return `Falar com ${objective.npcName ?? objective.npcId}`;
  }
  if (objective.type === "KILL") {
    return `Derrotar ${objective.bestiaryName ?? objective.bestiaryAnimaId}`;
  }
  return `Coletar ${objective.itemName ?? objective.itemId}`;
};

const pickRandom = <T,>(items: T[]) => {
  if (items.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
};

const isTileInsideArea = (area: boolean[][], point: GridPoint) => area[point.y]?.[point.x] === true;

const findNearestWalkableInArea = (origin: GridPoint, area: boolean[][], collisions: boolean[][]) => {
  const rows = area.length;
  const cols = area[0]?.length ?? 0;
  if (isTileInsideArea(area, origin) && collisions[origin.y]?.[origin.x] !== true) {
    return origin;
  }

  const visited = new Set<string>();
  const queue: GridPoint[] = [origin];
  visited.add(`${origin.x}:${origin.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const direction of enemyDirections) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) {
        continue;
      }
      const key = `${next.x}:${next.y}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      if (isTileInsideArea(area, next) && collisions[next.y]?.[next.x] !== true) {
        return next;
      }
      queue.push(next);
    }
  }

  return null;
};

const ENEMY_DEATH_DURATION_MS = 560;
const ENEMY_SPAWN_PORTAL_MS = 760;
const ENEMY_AGGRO_DURATION_MS = 600_000;
const DAMAGE_TEXT_TTL_MS = 760;
const ATTACK_EFFECT_TTL_MS = 320;
const ATTACK_LUNGE_DURATION_MS = 230;
const DROP_TTL_MS = 10_000;
const DROP_DRAW_SIZE = 30;
const DROP_HIT_RADIUS = 20;
const ENEMY_COMBAT_SPEED_MULTIPLIER = 1.3;
const ENEMY_LOW_HP_RATIO_TO_FLEE = 0.15;

const isAdjacentTile = (from: GridPoint, to: GridPoint) => Math.abs(from.x - to.x) <= 1 && Math.abs(from.y - to.y) <= 1;

const rollDamage = (attack: number, defense: number, critChance: number) => {
  const variance = 0.84 + Math.random() * 0.32;
  const base = Math.max(1, Math.round(attack * variance - defense * 0.45));
  const critical = Math.random() * 100 < critChance;
  const value = critical ? Math.max(2, Math.round(base * 1.5)) : base;
  return { value, critical };
};

const toHealthRatio = (hp: number, maxHp: number) => {
  if (maxHp <= 0) return 0;
  return clamp(hp / maxHp, 0, 1);
};

const getIdleBreath = (now: number, seed: number, enabled: boolean) => {
  if (!enabled) {
    return { bobY: 0, scaleX: 1, scaleY: 1, shadowPulse: 0 };
  }
  const wave = (Math.sin(now / 180 + seed) + 1) * 0.5;
  return {
    bobY: wave * 1.4,
    scaleX: 1 - wave * 0.018,
    scaleY: 1 + wave * 0.028,
    shadowPulse: -wave * 0.04,
  };
};

const drawSpriteShadow = (
  context: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  centerX: number,
  baseY: number,
  drawWidth: number,
  drawHeight: number,
  flipX: number,
  alpha: number,
) => {
  if (!sprite) {
    context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    context.beginPath();
    context.ellipse(centerX, baseY - 2, Math.max(4, drawWidth * 0.18), Math.max(2.2, TILE_SIZE * 0.08), 0, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.save();
  context.translate(centerX, baseY - 1);
  context.scale(flipX, 0.22);
  context.filter = `brightness(0) saturate(0) opacity(${clamp(alpha * 3.2, 0.12, 0.95)}) blur(0.6px)`;
  context.drawImage(sprite, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
  context.filter = "none";
  context.restore();
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
};

const hashNoise = (x: number, y: number, seed: number) => {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519) ^ Math.imul(seed + 1597334677, 3266489917);
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};

const drawEnemySpawnPortal = (
  context: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  drawWidth: number,
  spawnProgress: number,
  now: number,
) => {
  const spawnPhase = 1 - spawnProgress;
  if (spawnPhase <= 0) {
    return;
  }

  const radiusX = Math.max(9, drawWidth * (0.2 + spawnProgress * 0.14));
  const radiusY = Math.max(4.2, radiusX * 0.42);
  const glowAlpha = clamp(spawnPhase * 0.95, 0, 0.95);
  const swirl = now * 0.006;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = glowAlpha;

  const gradient = context.createRadialGradient(centerX, baseY - 2, radiusY * 0.35, centerX, baseY - 2, radiusX * 1.25);
  gradient.addColorStop(0, "rgba(110, 231, 255, 0.48)");
  gradient.addColorStop(0.55, "rgba(56, 189, 248, 0.24)");
  gradient.addColorStop(1, "rgba(14, 116, 144, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(centerX, baseY - 2, radiusX * 1.12, radiusY * 1.15, 0, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 2;
  context.strokeStyle = "rgba(45, 212, 191, 0.9)";
  context.beginPath();
  context.ellipse(centerX, baseY - 2, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.stroke();

  context.lineWidth = 1.4;
  context.strokeStyle = "rgba(125, 211, 252, 0.85)";
  context.beginPath();
  context.ellipse(centerX, baseY - 2, radiusX * 0.72, radiusY * 0.72, 0, 0, Math.PI * 2);
  context.stroke();

  const sigilCount = 10;
  for (let index = 0; index < sigilCount; index += 1) {
    const t = swirl + (index / sigilCount) * Math.PI * 2;
    const px = centerX + Math.cos(t) * radiusX * 0.92;
    const py = baseY - 2 + Math.sin(t) * radiusY * 0.92;
    context.fillStyle = "rgba(165, 243, 252, 0.86)";
    context.fillRect(px - 1.4, py - 1.4, 2.8, 2.8);
  }

  context.restore();
};

const drawSpriteDeathDissolve = (
  context: CanvasRenderingContext2D,
  sprite: CanvasImageSource,
  spriteWidth: number,
  spriteHeight: number,
  drawWidth: number,
  drawHeight: number,
  progress: number,
  seed: number,
) => {
  const blockSize = clamp(Math.floor(Math.min(drawWidth, drawHeight) / 13), 2, 6);
  const cols = Math.max(1, Math.ceil(drawWidth / blockSize));
  const rows = Math.max(1, Math.ceil(drawHeight / blockSize));
  const srcStepX = spriteWidth / cols;
  const srcStepY = spriteHeight / rows;
  const rise = progress * (drawHeight * 0.16 + 6);
  const spread = progress * 1.3;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const noise = hashNoise(col, row, seed);
      const threshold = noise * 0.95;
      if (progress > threshold) {
        continue;
      }

      const px = -drawWidth / 2 + col * blockSize;
      const py = -drawHeight + row * blockSize;
      const driftX = (hashNoise(row, col, seed + 11) - 0.5) * spread * blockSize;
      const driftY = -rise * (0.55 + noise * 0.45);

      context.globalAlpha = clamp(1 - progress * 0.78 + noise * 0.18, 0.08, 1);
      context.drawImage(
        sprite,
        col * srcStepX,
        row * srcStepY,
        srcStepX,
        srcStepY,
        px + driftX,
        py + driftY,
        blockSize + 0.65,
        blockSize + 0.65,
      );
    }
  }
  context.globalAlpha = 1;
};

export const ExplorarPage = () => {
  const [mapData, setMapData] = useState<GameMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [portalPrompt, setPortalPrompt] = useState<PortalPromptState | null>(null);
  const [teleporting, setTeleporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const spriteImageRef = useRef<HTMLImageElement | null>(null);
  const spriteFramesRef = useRef<SpriteFrame[] | null>(null);
  const spriteAnimationRef = useRef<SpriteAnimationState>({ index: 0, lastAt: 0, elapsed: 0 });
  const spriteBaseFlipRef = useRef(-1);
  const tileImageMapRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const enemySpriteMapRef = useRef<Map<string, SpriteAsset>>(new Map());
  const bestiaryStatsRef = useRef<Map<string, BestiaryAnima>>(new Map());
  const routeRef = useRef<GridPoint[]>([]);
  const routeAllowsCornerCutRef = useRef(false);
  const selectedEnemyIdRef = useRef<string | null>(null);
  const engagedEnemyIdRef = useRef<string | null>(null);
  const activePortalIdRef = useRef<string | null>(null);
  const suppressPortalPromptUntilLeaveRef = useRef(true);
  const portalPromptRef = useRef<PortalPromptState | null>(null);
  const teleportingRef = useRef(false);
  const damageTextsRef = useRef<DamageText[]>([]);
  const rewardTextsRef = useRef<RewardFloatingText[]>([]);
  const attackEffectsRef = useRef<AttackEffect[]>([]);
  const impactParticlesRef = useRef<ImpactParticle[]>([]);
  const impactRingsRef = useRef<ImpactRing[]>([]);
  const levelUpAuraRef = useRef<{ startedAt: number; ttlMs: number; level: number } | null>(null);
  const cameraShakeRef = useRef<{ startedAt: number; ttlMs: number; strength: number } | null>(null);
  const screenFlashRef = useRef<{ startedAt: number; ttlMs: number; intensity: number; color: string } | null>(null);
  const otherPlayersRef = useRef<Map<string, OtherPlayerRuntime>>(new Map());
  const groundDropsRef = useRef<GroundDrop[]>([]);
  const dropImageMapRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const collectingDropIdRef = useRef<string | null>(null);
  const cursorModeRef = useRef<"default" | "copy">("default");
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
  const enemyGroupsRef = useRef<Map<string, EnemyGroupRuntime>>(new Map());
  const enemiesRef = useRef<EnemyRuntime[]>([]);
  const npcSpriteMapRef = useRef<Map<string, SpriteAsset>>(new Map());
  const playerRef = useRef<PlayerRuntime>({
    animaName: "Anima",
    level: 1,
    experience: 0,
    experienceMax: 1000,
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
    hp: 100,
    maxHp: 100,
    attack: 36,
    defense: 14,
    critChance: 6,
    attackIntervalMs: 850,
    lastAttackAt: 0,
    hitFlashUntil: 0,
    attackLungeUntil: 0,
    attackLungeDx: 0,
    attackLungeDy: 0,
    attackLungeDistance: 0,
    trackingEnemyId: null,
    nextTrackingPathAt: 0,
  });

  const [spriteData, setSpriteData] = useState<string | null>(null);
  const [activeMapNpcs, setActiveMapNpcs] = useState<ActiveMapNpc[]>([]);
  const [npcInteractionState, setNpcInteractionState] = useState<NpcInteractionState | null>(null);
  const [npcConversationState, setNpcConversationState] = useState<NpcConversationState | null>(null);
  const [npcShopState, setNpcShopState] = useState<NpcShopState | null>(null);
  const [shopSubmittingKey, setShopSubmittingKey] = useState<string | null>(null);
  const [craftSearch, setCraftSearch] = useState("");
  const [confirmShopAction, setConfirmShopAction] = useState<
    | { type: "buy"; offer: NpcShopBuyOffer }
    | { type: "craft"; recipe: NpcShopCraftRecipe }
    | null
  >(null);
  const [actionResult, setActionResult] = useState<{ title: string; description: string } | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [itemCatalog, setItemCatalog] = useState<Map<string, Item>>(new Map());
  const [activeQuests, setActiveQuests] = useState<PlayerQuest[]>([]);
  const [completedQuests, setCompletedQuests] = useState<PlayerQuest[]>([]);
  const [questDetail, setQuestDetail] = useState<PlayerQuest | null>(null);
  const [questLoading, setQuestLoading] = useState(false);
  const [npcConversationSubmitting, setNpcConversationSubmitting] = useState(false);
  const [questHudOffset, setQuestHudOffset] = useState({ x: 0, y: 0 });
  const [questHudDragging, setQuestHudDragging] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [evolutionVfx, setEvolutionVfx] = useState<EvolutionVfxState | null>(null);
  const questHudDragRef = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  useEffect(() => {
    portalPromptRef.current = portalPrompt;
  }, [portalPrompt]);

  useEffect(() => {
    teleportingRef.current = teleporting;
  }, [teleporting]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("explore:focus-mode", {
        detail: { enabled: focusMode },
      }),
    );
  }, [focusMode]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("explore:focus-mode", {
          detail: { enabled: false },
        }),
      );
    };
  }, []);

  useEffect(() => {
    const onAnimaEvolved = (
      event: Event & {
        detail?: {
          action?: "evolved" | "regressed";
          from: AdoptedAnima;
          to: AdoptedAnima;
        };
      },
    ) => {
      const detail = event.detail;
      if (!detail?.to) {
        return;
      }
      const tone = detail.action === "regressed" ? "regressed" : "evolved";

      const evolved = detail.to;
      playerRef.current.animaName = evolved.nickname?.trim() || evolved.baseAnima.name || "Anima";
      playerRef.current.level = Math.max(1, evolved.level);
      playerRef.current.experience = Math.max(0, evolved.experience);
      playerRef.current.experienceMax = Math.max(1, evolved.experienceMax);
      playerRef.current.maxHp = Math.max(1, evolved.totalMaxHp ?? evolved.baseAnima.maxHp ?? 100);
      playerRef.current.hp = clamp(evolved.currentHp, 1, playerRef.current.maxHp);
      playerRef.current.attack = Math.max(1, evolved.totalAttack ?? evolved.baseAnima.attack ?? 36);
      playerRef.current.defense = Math.max(0, evolved.totalDefense ?? evolved.baseAnima.defense ?? 14);
      playerRef.current.critChance = clamp(evolved.totalCritChance ?? evolved.baseAnima.critChance ?? 6, 0, 100);
      playerRef.current.attackIntervalMs = Math.max(
        160,
        Math.floor((evolved.totalAttackSpeedSeconds ?? evolved.baseAnima.attackSpeedSeconds ?? 0.9) * 1000),
      );
      const nextScale = Math.max(evolved.baseAnima.spriteScale ?? 3, 0.1);
      spriteBaseFlipRef.current = evolved.baseAnima.flipHorizontal === false ? 1 : -1;

      const now = performance.now();
      screenFlashRef.current = {
        startedAt: now,
        ttlMs: 260,
        intensity: 0.62,
        color: tone === "evolved" ? "rgba(103, 232, 249, 1)" : "rgba(251, 191, 36, 1)",
      };
      cameraShakeRef.current = {
        startedAt: now,
        ttlMs: 360,
        strength: 0.85,
      };
      const centerX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
      const centerY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.45;
      impactRingsRef.current.push({
        id: `${now}_evo_ring`,
        x: centerX,
        y: centerY,
        createdAt: now,
        ttlMs: 760,
        color: tone === "evolved" ? "rgba(34, 211, 238, 1)" : "rgba(251, 191, 36, 1)",
        critical: true,
      });
      impactRingsRef.current.push({
        id: `${now}_evo_ring_secondary`,
        x: centerX,
        y: centerY,
        createdAt: now + 90,
        ttlMs: 920,
        color: tone === "evolved" ? "rgba(167, 243, 208, 1)" : "rgba(254, 215, 170, 1)",
        critical: true,
      });

      for (let index = 0; index < 30; index += 1) {
        const angle = (Math.PI * 2 * index) / 30 + Math.random() * 0.2;
        const speed = 1.5 + Math.random() * 2.6;
        impactParticlesRef.current.push({
          id: `${now}_evo_particle_${index}`,
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          createdAt: now,
          ttlMs: 760 + Math.floor(Math.random() * 280),
          size: 2.8 + Math.random() * 2.6,
          color: tone === "evolved" ? "rgba(125, 211, 252, 0.95)" : "rgba(251, 191, 36, 0.95)",
          glow: true,
          gravity: 0.03,
        });
      }
      setEvolutionVfx({
        active: true,
        tone,
      });

      const fromImage = detail.from?.baseAnima?.imageData ?? null;
      if (fromImage) {
        setSpriteData(fromImage);
      }

      window.setTimeout(() => {
        setSpriteData(evolved.baseAnima.imageData ?? null);
        playerRef.current.scaleX = nextScale;
        playerRef.current.scaleY = nextScale;
        screenFlashRef.current = {
          startedAt: performance.now(),
          ttlMs: 180,
          intensity: 0.38,
          color: tone === "evolved" ? "rgba(103, 232, 249, 1)" : "rgba(251, 191, 36, 1)",
        };
      }, 260);
      window.setTimeout(() => {
        setEvolutionVfx(null);
      }, 1650);
    };

    window.addEventListener("explore:anima-evolved", onAnimaEvolved as EventListener);
    return () => {
      window.removeEventListener("explore:anima-evolved", onAnimaEvolved as EventListener);
    };
  }, []);

  useEffect(() => {
    let active = true;
    listItems()
      .then((items) => {
        if (!active) {
          return;
        }
        setItemCatalog(new Map(items.map((item) => [item.id, item])));
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Falha ao carregar itens.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
      const visualFootprintWidthPx = Math.max(TILE_SIZE, sourceSize.width * spriteBaseUnit * playerRef.current.scaleX);
      const footprintWidthPx = clamp(visualFootprintWidthPx, TILE_SIZE, TILE_SIZE * 3);
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

  const rebuildEnemies = useCallback((map: GameMap) => {
    const groups = new Map<string, EnemyGroupRuntime>();
    const instances: EnemyRuntime[] = [];
    const now = performance.now();

    for (const config of map.enemySpawns ?? []) {
      const bestiary = bestiaryStatsRef.current.get(config.bestiaryAnimaId) ?? null;
      const spawnTiles: GridPoint[] = [];
      const movementTiles: GridPoint[] = [];
      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          if (config.spawnArea[y]?.[x] === true && map.collisionLayer[y]?.[x] !== true) {
            spawnTiles.push({ x, y });
          }
          if (config.movementArea[y]?.[x] === true && map.collisionLayer[y]?.[x] !== true) {
            movementTiles.push({ x, y });
          }
        }
      }

      const runtime: EnemyGroupRuntime = {
        id: config.id,
        bestiaryAnimaId: config.bestiaryAnimaId,
        name: bestiary?.name ?? config.bestiaryName ?? "Inimigo",
        respawnMs: Math.max(500, Math.floor(config.respawnSeconds * 1000)),
        movementSpeed: Math.max(config.movementSpeed ?? 2.2, 0.25),
        attack: Math.max(1, bestiary?.attack ?? 28),
        defense: Math.max(0, bestiary?.defense ?? 10),
        maxHp: Math.max(1, bestiary?.maxHp ?? 220),
        critChance: clamp(bestiary?.critChance ?? 4, 0, 100),
        attackIntervalMs: Math.max(240, Math.floor((bestiary?.attackSpeedSeconds ?? 1.25) * 1000)),
        spawnArea: config.spawnArea,
        movementArea: config.movementArea,
        movementCollisionLayer: [],
        spawnTiles,
        movementTiles: movementTiles.length > 0 ? movementTiles : spawnTiles,
        spriteScale: Math.max(config.spriteScale || 3, 0.1),
        flipHorizontal: config.flipHorizontal === true,
      };
      const activeMovementArea = runtime.movementTiles === movementTiles ? config.movementArea : config.spawnArea;
      runtime.movementArea = activeMovementArea;
      runtime.movementCollisionLayer = Array.from({ length: map.rows }, (_, y) =>
        Array.from({ length: map.cols }, (_, x) => map.collisionLayer[y]?.[x] === true || activeMovementArea[y]?.[x] !== true),
      );
      groups.set(config.id, runtime);

      const shuffledSpawnTiles = spawnTiles.length > 1 ? [...spawnTiles].sort(() => Math.random() - 0.5) : spawnTiles;
      for (let index = 0; index < config.spawnCount; index += 1) {
        const tile =
          shuffledSpawnTiles[index] ??
          pickRandom(runtime.spawnTiles) ??
          pickRandom(runtime.movementTiles) ??
          null;

        instances.push({
          id: `${config.id}:${index}`,
          groupId: config.id,
          tileX: tile?.x ?? map.spawnX,
          tileY: tile?.y ?? map.spawnY,
          renderX: tile?.x ?? map.spawnX,
          renderY: tile?.y ?? map.spawnY,
          moving: false,
          fromX: tile?.x ?? map.spawnX,
          fromY: tile?.y ?? map.spawnY,
          toX: tile?.x ?? map.spawnX,
          toY: tile?.y ?? map.spawnY,
          moveStartedAt: now,
          moveDurationMs: 180,
          route: [],
          facingX: -1,
          spawned: tile !== null,
          respawnAt: tile ? 0 : now + runtime.respawnMs,
          nextDecisionAt: now + 350 + Math.random() * 1100,
          maxHp: runtime.maxHp,
          hp: runtime.maxHp,
          attack: runtime.attack,
          defense: runtime.defense,
          critChance: runtime.critChance,
          attackIntervalMs: runtime.attackIntervalMs,
          lastAttackAt: 0,
          hitFlashUntil: 0,
          attackLungeUntil: 0,
          attackLungeDx: 0,
          attackLungeDy: 0,
          attackLungeDistance: 0,
          deathStartedAt: 0,
          spawnFxUntil: tile ? now + ENEMY_SPAWN_PORTAL_MS : 0,
          aggroUntilAt: 0,
        });
      }
    }

    enemyGroupsRef.current = groups;
    enemiesRef.current = instances;
  }, []);

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

  const planNpcApproach = useCallback(
    (npc: ActiveMapNpc) => {
      if (!mapData) {
        return false;
      }
      const playerPoint = { x: playerRef.current.tileX, y: playerRef.current.tileY };
      const npcPoint = { x: npc.tileX, y: npc.tileY };
      if (isAdjacentTile(playerPoint, npcPoint)) {
        return false;
      }
      const navigationLayer = buildNavigationCollisionLayer(mapData);
      const candidates = enemyDirections
        .map((direction) => ({ x: npcPoint.x + direction.x, y: npcPoint.y + direction.y }))
        .filter((candidate) => isWalkableForPlayer(mapData, candidate, navigationLayer));
      let destination: GridPoint | null = null;
      if (candidates.length > 0) {
        destination = candidates.reduce((best, candidate) => {
          const bestDistance = Math.hypot(best.x - playerPoint.x, best.y - playerPoint.y);
          const candidateDistance = Math.hypot(candidate.x - playerPoint.x, candidate.y - playerPoint.y);
          return candidateDistance < bestDistance ? candidate : best;
        }, candidates[0]);
      } else {
        destination = findNearestWalkableTile(npcPoint, navigationLayer);
      }
      if (destination) {
        recalculatePath(destination);
        return true;
      }
      return false;
    },
    [buildNavigationCollisionLayer, isWalkableForPlayer, mapData, recalculatePath],
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

  const pointerToWorld = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      return {
        x: cameraRef.current.x + (event.clientX - rect.left),
        y: cameraRef.current.y + (event.clientY - rect.top),
      };
    },
    [],
  );

  const findEnemyAtWorldPoint = useCallback(
    (worldX: number, worldY: number): EnemyRuntime | null => {
      const ordered = enemiesRef.current
        .filter((enemy) => enemy.spawned && enemy.deathStartedAt === 0)
        .sort((left, right) => right.renderY - left.renderY);

      for (const enemy of ordered) {
        const group = enemyGroupsRef.current.get(enemy.groupId);
        if (!group) {
          continue;
        }

        const spriteAsset = enemySpriteMapRef.current.get(enemy.groupId);
        const spriteSource =
          spriteAsset?.frames?.[0]?.canvas ??
          (spriteAsset?.image && spriteAsset.image.complete ? spriteAsset.image : null);
        const sourceWidth = spriteSource && "width" in spriteSource ? spriteSource.width : TILE_SIZE;
        const sourceHeight = spriteSource && "height" in spriteSource ? spriteSource.height : TILE_SIZE;
        const baseUnit = TILE_SIZE / Math.max(sourceWidth, sourceHeight);
        const drawWidth = sourceWidth * baseUnit * group.spriteScale;
        const drawHeight = sourceHeight * baseUnit * group.spriteScale;
        const centerX = enemy.renderX * TILE_SIZE + TILE_SIZE / 2;
        const baseY = enemy.renderY * TILE_SIZE + TILE_SIZE;
        const left = centerX - drawWidth / 2;
        const right = centerX + drawWidth / 2;
        const top = baseY - drawHeight;
        const bottom = baseY;

        if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
          return enemy;
        }
      }

      return null;
    },
    [],
  );

  const findEnemyAtTile = useCallback((tile: GridPoint): EnemyRuntime | null => {
    const candidates = enemiesRef.current.filter((enemy) => enemy.spawned && enemy.deathStartedAt === 0);
    let best: EnemyRuntime | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const enemy of candidates) {
      const dx = enemy.renderX - tile.x;
      const dy = enemy.renderY - tile.y;
      const score = dx * dx + dy * dy;
      if (score <= 1.6 && score < bestScore) {
        best = enemy;
        bestScore = score;
      }
    }

    return best;
  }, []);

  const findNpcAtWorldPoint = useCallback(
    (worldX: number, worldY: number): ActiveMapNpc | null => {
      const ordered = [...activeMapNpcs].sort((left, right) => left.tileY - right.tileY);
      for (const npc of ordered) {
        const centerX = npc.tileX * TILE_SIZE + TILE_SIZE / 2;
        const baseY = npc.tileY * TILE_SIZE + TILE_SIZE;
        const width = Math.max(8, npc.width ?? 96);
        const height = Math.max(8, npc.height ?? 96);
        const left = centerX - width / 2;
        const right = centerX + width / 2;
        const top = baseY - height;
        const bottom = baseY;
        if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
          return npc;
        }
      }

      return null;
    },
    [activeMapNpcs],
  );

  const findDropAtWorldPoint = useCallback((worldX: number, worldY: number): GroundDrop | null => {
    const ordered = [...groundDropsRef.current]
      .filter((drop) => !drop.collecting)
      .sort((left, right) => right.worldY - left.worldY);

    for (const drop of ordered) {
      const dx = worldX - drop.worldX;
      const dy = worldY - (drop.worldY - 10);
      if (dx * dx + dy * dy <= DROP_HIT_RADIUS * DROP_HIT_RADIUS) {
        return drop;
      }
    }

    return null;
  }, []);

  const tryStartMove = useCallback(
    (target: GridPoint, options?: { allowCornerCut?: boolean }) => {
      const map = mapData;
      if (!map) return false;
      const navigationLayer = buildNavigationCollisionLayer(map);
      if (!isWalkableForPlayer(map, target, navigationLayer)) return false;

      const current = { x: playerRef.current.tileX, y: playerRef.current.tileY };
      const currentBlocked = !isWalkableForPlayer(map, current, navigationLayer);
      const dx = target.x - current.x;
      const dy = target.y - current.y;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        return false;
      }

      if (dx !== 0 && dy !== 0 && options?.allowCornerCut !== true && !currentBlocked) {
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

  const cancelTracking = useCallback(() => {
    playerRef.current.trackingEnemyId = null;
    playerRef.current.nextTrackingPathAt = 0;
    collectingDropIdRef.current = null;
    selectedEnemyIdRef.current = null;
  }, []);

  const setCanvasCursorMode = useCallback((mode: "default" | "copy") => {
    if (cursorModeRef.current === mode) {
      return;
    }

    cursorModeRef.current = mode;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = mode;
    }
  }, []);

  const triggerCameraShake = useCallback((strength: number, ttlMs: number) => {
    const now = performance.now();
    const normalizedStrength = clamp(strength, 0, 1);
    const nextTtl = Math.max(1, ttlMs);
    const current = cameraShakeRef.current;
    if (!current || now - current.startedAt >= current.ttlMs) {
      cameraShakeRef.current = { startedAt: now, ttlMs: nextTtl, strength: normalizedStrength };
      return;
    }
    cameraShakeRef.current = {
      startedAt: now,
      ttlMs: Math.max(current.ttlMs, nextTtl),
      strength: clamp(current.strength + normalizedStrength, 0, 1),
    };
  }, []);

  const triggerScreenFlash = useCallback((intensity: number, ttlMs: number, color: string) => {
    const now = performance.now();
    const next = {
      startedAt: now,
      ttlMs: Math.max(1, ttlMs),
      intensity: clamp(intensity, 0, 1),
      color,
    };
    const current = screenFlashRef.current;
    if (!current || now - current.startedAt >= current.ttlMs) {
      screenFlashRef.current = next;
      return;
    }
    screenFlashRef.current = {
      ...next,
      intensity: clamp(current.intensity + next.intensity * 0.7, 0, 1),
      ttlMs: Math.max(current.ttlMs, next.ttlMs),
    };
  }, []);

  const spawnImpactVfx = useCallback((x: number, y: number, fromEnemy: boolean, critical: boolean) => {
    const now = performance.now();
    const baseColor = fromEnemy ? "rgba(251, 146, 60, 1)" : "rgba(248, 113, 113, 1)";
    const critColor = "rgba(253, 224, 71, 1)";
    const primary = critical ? critColor : baseColor;
    const particleCount = critical ? 18 : 12;
    const baseSpeed = critical ? 560 : 420;
    const ttlBase = critical ? 520 : 420;

    impactRingsRef.current.push({
      id: `${now}_ring_${Math.random().toString(16).slice(2, 8)}`,
      x,
      y,
      createdAt: now,
      ttlMs: critical ? 420 : 340,
      color: primary,
      critical,
    });

    for (let i = 0; i < particleCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.55 + Math.random() * 0.75);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - (critical ? 140 : 90);
      impactParticlesRef.current.push({
        id: `${now}_p_${i}_${Math.random().toString(16).slice(2, 6)}`,
        x,
        y,
        vx,
        vy,
        createdAt: now,
        ttlMs: ttlBase * (0.7 + Math.random() * 0.6),
        size: critical ? 2.2 + Math.random() * 1.8 : 1.6 + Math.random() * 1.4,
        color: i % 4 === 0 ? "rgba(248, 250, 252, 1)" : primary,
        glow: i % 3 !== 0,
        gravity: critical ? 980 : 860,
      });
    }

    triggerCameraShake(critical ? (fromEnemy ? 0.55 : 0.7) : fromEnemy ? 0.35 : 0.42, critical ? 260 : 200);
    if (critical) {
      triggerScreenFlash(fromEnemy ? 0.22 : 0.28, 120, "rgba(253, 224, 71, 1)");
    } else if (fromEnemy) {
      triggerScreenFlash(0.12, 90, "rgba(251, 146, 60, 1)");
    }
  }, [triggerCameraShake, triggerScreenFlash]);

  const pushDamageText = useCallback((x: number, y: number, value: number, critical: boolean, fromEnemy: boolean) => {
    damageTextsRef.current.push({
      id: `${performance.now()}_${Math.random().toString(16).slice(2, 8)}`,
      x,
      y,
      value,
      critical,
      fromEnemy,
      createdAt: performance.now(),
      ttlMs: DAMAGE_TEXT_TTL_MS,
    });
  }, []);

  const pushRewardText = useCallback((x: number, y: number, text: string, color: string, scale = 1) => {
    rewardTextsRef.current.push({
      id: `${performance.now()}_${Math.random().toString(16).slice(2, 8)}`,
      x,
      y,
      text,
      color,
      scale,
      createdAt: performance.now(),
      ttlMs: 1000,
    });
  }, []);

  const pushAttackEffect = useCallback((fromX: number, fromY: number, toX: number, toY: number, fromEnemy: boolean, critical: boolean) => {
    spawnImpactVfx(toX, toY, fromEnemy, critical);
    attackEffectsRef.current.push({
      id: `${performance.now()}_${Math.random().toString(16).slice(2, 8)}`,
      fromX,
      fromY,
      toX,
      toY,
      fromEnemy,
      critical,
      createdAt: performance.now(),
      ttlMs: ATTACK_EFFECT_TTL_MS,
    });
  }, [spawnImpactVfx]);

  const spawnGroundDropsForEnemy = useCallback((enemy: EnemyRuntime, now: number) => {
    const group = enemyGroupsRef.current.get(enemy.groupId);
    if (!group) {
      return [] as Array<{ itemId: string; quantity: number }>;
    }

    const bestiary = bestiaryStatsRef.current.get(group.bestiaryAnimaId);
    if (!bestiary || !bestiary.drops || bestiary.drops.length === 0) {
      return [] as Array<{ itemId: string; quantity: number }>;
    }

    const generated: GroundDrop[] = [];
    const droppedItems: Array<{ itemId: string; quantity: number }> = [];
    for (const drop of bestiary.drops) {
      const roll = Math.random() * 100;
      if (roll > drop.dropChance) {
        continue;
      }

      const index = generated.length;
      const worldBaseX = enemy.tileX * TILE_SIZE + TILE_SIZE / 2;
      const worldBaseY = enemy.tileY * TILE_SIZE + TILE_SIZE * 0.82;
      const jitterX = ((index % 3) - 1) * 8;
      const jitterY = Math.floor(index / 3) * 5;
      const dropId = `${enemy.id}_${drop.itemId}_${now}_${index}`;

      generated.push({
        id: dropId,
        itemId: drop.itemId,
        itemName: drop.item.name,
        imageData: drop.item.imageData,
        quantity: Math.max(1, Math.floor(drop.quantity)),
        tileX: enemy.tileX,
        tileY: enemy.tileY,
        worldX: worldBaseX + jitterX,
        worldY: worldBaseY + jitterY,
        spawnedAt: now,
        expiresAt: now + DROP_TTL_MS,
        collecting: false,
      });
      droppedItems.push({
        itemId: drop.itemId,
        quantity: Math.max(1, Math.floor(drop.quantity)),
      });

      if (drop.item.imageData && !dropImageMapRef.current.has(dropId)) {
        const image = new Image();
        image.src = drop.item.imageData;
        dropImageMapRef.current.set(dropId, image);
      }
    }

    if (generated.length > 0) {
      groundDropsRef.current.push(...generated);
    }
    return droppedItems;
  }, []);

  const hydrateMapRuntime = useCallback((map: GameMap): GameMap => {
    const normalizedEnemySpawns = (map.enemySpawns ?? []).map((group) => {
      const fallback = bestiaryStatsRef.current.get(group.bestiaryAnimaId);
      return {
        ...group,
        bestiaryName: fallback?.name ?? group.bestiaryName ?? null,
        imageData: fallback?.imageData ?? group.imageData ?? null,
        spriteScale: Math.max(fallback?.spriteScale ?? group.spriteScale ?? 3, 0.1),
        flipHorizontal: fallback?.flipHorizontal ?? group.flipHorizontal ?? false,
        movementSpeed: Math.max(group.movementSpeed ?? 2.2, 0.25),
      };
    });
    const normalizedPortals = (map.portals ?? []).map((portal) => ({
      ...portal,
      targetMapName: portal.targetMapName ?? null,
    }));
    const normalizedNpcPlacements = (map.npcPlacements ?? []).map((placement) => ({
      ...placement,
      npcName: placement.npcName ?? null,
      imageData: placement.imageData ?? null,
      width: Math.max(8, placement.width ?? 96),
      height: Math.max(8, placement.height ?? 96),
    }));

    return {
      ...map,
      enemySpawns: normalizedEnemySpawns,
      portals: normalizedPortals,
      npcPlacements: normalizedNpcPlacements,
    };
  }, []);

  const refreshQuestState = useCallback(async () => {
    setQuestLoading(true);
    try {
      const quests = await listPlayerQuests();
      setActiveQuests(quests.activeQuests);
      setCompletedQuests(quests.completedQuests);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao carregar quests.");
      }
    } finally {
      setQuestLoading(false);
    }
  }, []);

  const refreshActiveNpcs = useCallback(async () => {
    try {
      const npcs = await listActiveMapNpcs();
      setActiveMapNpcs(npcs);
      const spriteMap = new Map<string, SpriteAsset>();
      for (const npc of npcs) {
        const imageData = npc.npc?.imageData ?? npc.imageData;
        if (!imageData) {
          continue;
        }
        spriteMap.set(npc.id, createSpriteAsset(imageData));
      }
      npcSpriteMapRef.current = spriteMap;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao carregar NPCs do mapa.");
      }
    }
  }, []);

  const activeQuestKeys = useMemo(() => {
    return new Set(activeQuests.map((quest) => quest.questKey));
  }, [activeQuests]);

  const turnInQuestByKey = useMemo(() => {
    const output = new Map<string, PlayerQuest>();
    for (const quest of activeQuests) {
      if (quest.turnInReady) {
        output.set(quest.questKey, quest);
      }
    }
    return output;
  }, [activeQuests]);

  const turnInQuestTypesByNpc = useMemo(() => {
    const output = new Map<string, QuestType[]>();
    for (const quest of activeQuests) {
      if (!quest.turnInReady) {
        continue;
      }
      const list = output.get(quest.sourceNpcId) ?? [];
      list.push(quest.questType);
      output.set(quest.sourceNpcId, list);
    }
    return output;
  }, [activeQuests]);

  const completedQuestKeys = useMemo(() => {
    return new Set(completedQuests.map((quest) => quest.questKey));
  }, [completedQuests]);

  const isQuestDialogAvailable = useCallback(
    (npcId: string, dialog: NpcDialog) => {
      if (!dialog.quest) {
        return false;
      }

      const questKey = `${npcId}:${dialog.id}`;
      if (activeQuestKeys.has(questKey)) {
        return false;
      }
      if (!completedQuestKeys.has(questKey)) {
        return true;
      }
      return normalizeQuestType(dialog.quest.questType) === "REPEATABLE";
    },
    [activeQuestKeys, completedQuestKeys],
  );

  const startQuestHudDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    questHudDragRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startOffsetX: questHudOffset.x,
      startOffsetY: questHudOffset.y,
    };
    setQuestHudDragging(true);
  }, [questHudOffset.x, questHudOffset.y]);

  useEffect(() => {
    if (!questHudDragging) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const dragState = questHudDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startPointerX;
      const deltaY = event.clientY - dragState.startPointerY;
      setQuestHudOffset({
        x: dragState.startOffsetX + deltaX,
        y: dragState.startOffsetY + deltaY,
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const dragState = questHudDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      questHudDragRef.current = null;
      setQuestHudDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [questHudDragging]);

  const runNpcDialogAction = useCallback(
    async (npc: ActiveMapNpc, dialog: NpcDialog, questAction?: { mode: "accept" | "deliver"; questId: string | null }) => {
      if (dialog.actionType === "QUEST") {
        if (questAction?.mode === "deliver" && questAction.questId) {
          const result = await deliverNpcQuest(npc.npcId, questAction.questId);
          setActiveQuests(result.activeQuests);
          setCompletedQuests(result.completedQuests);
          playerRef.current.level = Math.max(1, result.level);
          playerRef.current.experience = Math.max(0, result.experience);
          playerRef.current.experienceMax = Math.max(1, result.experienceMax);
          return;
        }

        const result = await acceptNpcQuest(npc.npcId, dialog.id);
        if (result.accepted && result.activeQuests) {
          setActiveQuests(result.activeQuests);
          return;
        }
        await refreshQuestState();
        return;
      }

      if (dialog.actionType === "SHOP_BUY" || dialog.actionType === "SHOP_CRAFT") {
        setNpcShopState({
          npcId: npc.npcId,
          dialogId: dialog.id,
          dialog,
        });
      }
    },
    [refreshQuestState],
  );

  const openNpcConversation = useCallback(
    (
      npc: ActiveMapNpc,
      dialogs: NpcDialog[],
      questAction: { mode: "accept" | "deliver"; questId: string | null } = { mode: "accept", questId: null },
    ) => {
      if (planNpcApproach(npc)) {
        return;
      }
      if (dialogs.length === 0) {
        return;
      }
      setNpcInteractionState(null);
      setNpcConversationSubmitting(false);
      setNpcConversationState({
        npc,
        dialogs,
        index: 0,
        questAction,
      });
    },
    [planNpcApproach],
  );

  const handleAdvanceNpcConversation = useCallback(async () => {
    if (!npcConversationState || npcConversationSubmitting) {
      return;
    }

    const dialogs = npcConversationState.dialogs;
    const currentDialog = dialogs[npcConversationState.index];
    const nextIndex = npcConversationState.index + 1;
    if (nextIndex < dialogs.length) {
      setNpcConversationState((current) => (current ? { ...current, index: nextIndex } : current));
      return;
    }

    setNpcConversationSubmitting(true);
    setNpcConversationState(null);
    if (currentDialog) {
      try {
        await runNpcDialogAction(npcConversationState.npc, currentDialog, npcConversationState.questAction);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Falha ao concluir acao do dialogo.");
        }
      } finally {
        setNpcConversationSubmitting(false);
      }
      return;
    }
    setNpcConversationSubmitting(false);
  }, [npcConversationState, npcConversationSubmitting, runNpcDialogAction]);

  const handleConfirmShopAction = useCallback(async () => {
    if (!confirmShopAction || !npcShopState) {
      return;
    }
    setActionSubmitting(true);
    if (confirmShopAction.type === "buy") {
      const offer = confirmShopAction.offer;
      setShopSubmittingKey(offer.id);
      try {
        const result = await buyFromNpc({
          npcId: npcShopState.npcId,
          dialogId: npcShopState.dialogId,
          offerId: offer.id,
        });
        setErrorMessage(null);
        setConfirmShopAction(null);
        setActionResult({
          title: "Compra concluida",
          description: `${offer.itemName ?? offer.itemId} x${result.quantity} adicionado ao inventario.`,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(null);
          setActionResult({
            title: "Nao foi possivel comprar",
            description: error.message,
          });
        } else {
          setActionResult({
            title: "Nao foi possivel comprar",
            description: "Falha ao comprar item.",
          });
        }
      } finally {
        setShopSubmittingKey(null);
        setActionSubmitting(false);
      }
      return;
    }

    const recipe = confirmShopAction.recipe;
    setShopSubmittingKey(recipe.id);
    try {
      const result = await craftAtNpc({
        npcId: npcShopState.npcId,
        dialogId: npcShopState.dialogId,
        recipeId: recipe.id,
      });
      setErrorMessage(null);
      setConfirmShopAction(null);
      setActionResult({
        title: "Craft concluido",
        description: `${recipe.resultItemName ?? recipe.resultItemId} x${result.quantity} criado.`,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(null);
        setActionResult({
          title: "Nao foi possivel craftar",
          description: error.message,
        });
      } else {
        setActionResult({
          title: "Nao foi possivel craftar",
          description: "Falha ao craftar item.",
        });
      }
    } finally {
      setShopSubmittingKey(null);
      setActionSubmitting(false);
    }
  }, [confirmShopAction, npcShopState]);

  const confirmPortalTeleport = useCallback(async () => {
    if (!portalPrompt || teleporting) {
      return;
    }

    setTeleporting(true);
    try {
      const payload = await usePortal(portalPrompt.portalId);
      const nextMap = hydrateMapRuntime(payload.map);
      setMapData(nextMap);
      playerRef.current.tileX = payload.state.tileX;
      playerRef.current.tileY = payload.state.tileY;
      playerRef.current.renderX = payload.state.tileX;
      playerRef.current.renderY = payload.state.tileY;
      playerRef.current.fromX = payload.state.tileX;
      playerRef.current.fromY = payload.state.tileY;
      playerRef.current.toX = payload.state.tileX;
      playerRef.current.toY = payload.state.tileY;
      playerRef.current.scaleX = payload.state.scaleX;
      playerRef.current.scaleY = payload.state.scaleY;
      playerRef.current.moving = false;
      playerRef.current.moveStartedAt = 0;
      routeRef.current = [];
      routeAllowsCornerCutRef.current = false;
      mouseHeldRef.current = false;
      hoverTargetRef.current = null;
      activePortalIdRef.current = null;
      suppressPortalPromptUntilLeaveRef.current = true;
      selectedEnemyIdRef.current = null;
      engagedEnemyIdRef.current = null;
      damageTextsRef.current = [];
      rewardTextsRef.current = [];
      attackEffectsRef.current = [];
      groundDropsRef.current = [];
      dropImageMapRef.current = new Map();
      collectingDropIdRef.current = null;
      setPortalPrompt(null);
      setNpcInteractionState(null);
      setNpcConversationState(null);
      cancelTracking();
      await refreshActiveNpcs();
      await refreshQuestState();
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao atravessar portal.");
      }
    } finally {
      setTeleporting(false);
    }
  }, [cancelTracking, hydrateMapRuntime, portalPrompt, refreshActiveNpcs, refreshQuestState, teleporting]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [active, adopted, bestiary] = await Promise.all([
          getActiveMap(),
          listAdoptedAnimas(),
          listBestiaryAnimas().catch(() => [] as BestiaryAnima[]),
        ]);
        if (!mounted) return;

        const bestiaryMap = new Map(bestiary.map((item) => [item.id, item]));
        bestiaryStatsRef.current = bestiaryMap;
        setMapData(hydrateMapRuntime(active.map));
        groundDropsRef.current = [];
        dropImageMapRef.current = new Map();
        collectingDropIdRef.current = null;
        suppressPortalPromptUntilLeaveRef.current = true;
        playerRef.current.tileX = active.state.tileX;
        playerRef.current.tileY = active.state.tileY;
        playerRef.current.renderX = active.state.tileX;
        playerRef.current.renderY = active.state.tileY;
        const primary = adopted.find((item) => item.isPrimary) ?? null;
        playerRef.current.animaName = primary?.nickname?.trim() || primary?.baseAnima.name || "Anima";
        playerRef.current.level = Math.max(1, primary?.level ?? 1);
        playerRef.current.experience = Math.max(0, primary?.experience ?? 0);
        playerRef.current.experienceMax = Math.max(1, primary?.experienceMax ?? 1000);
        const hasAnimaScale = typeof primary?.baseAnima.spriteScale === "number";
        const animaScale = Math.max(primary?.baseAnima.spriteScale ?? 3, 0.1);
        const initialScaleX = hasAnimaScale ? animaScale : active.state.scaleX;
        const initialScaleY = hasAnimaScale ? animaScale : active.state.scaleY;

        playerRef.current.scaleX = initialScaleX;
        playerRef.current.scaleY = initialScaleY;
        playerRef.current.maxHp = Math.max(1, primary?.totalMaxHp ?? primary?.baseAnima.maxHp ?? 100);
        playerRef.current.hp = playerRef.current.maxHp;
        playerRef.current.attack = Math.max(1, primary?.totalAttack ?? primary?.baseAnima.attack ?? 36);
        playerRef.current.defense = Math.max(0, primary?.totalDefense ?? primary?.baseAnima.defense ?? 14);
        playerRef.current.critChance = clamp(primary?.totalCritChance ?? primary?.baseAnima.critChance ?? 6, 0, 100);
        playerRef.current.attackIntervalMs = Math.max(
          160,
          Math.floor((primary?.totalAttackSpeedSeconds ?? primary?.baseAnima.attackSpeedSeconds ?? 0.9) * 1000),
        );
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

        await Promise.all([refreshActiveNpcs(), refreshQuestState()]);
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
  }, [hydrateMapRuntime, refreshActiveNpcs, refreshQuestState]);

  useEffect(() => {
    if (!mapData) {
      otherPlayersRef.current = new Map();
      return;
    }

    let cancelled = false;

    const syncPlayers = async () => {
      try {
        const players = await listActivePlayers();
        if (cancelled) return;

        const previousPlayers = otherPlayersRef.current;
        const nextMap = new Map<string, OtherPlayerRuntime>();
        for (const player of players) {
          const parsedUpdatedAt = Date.parse(player.updatedAt);
          const previous = previousPlayers.get(player.userId) ?? null;
          let facingX: -1 | 1 = previous?.facingX ?? -1;
          if (previous) {
            if (player.tileX > previous.tileX) {
              facingX = 1;
            } else if (player.tileX < previous.tileX) {
              facingX = -1;
            }
          }

          const animaImageData = null;

          nextMap.set(player.userId, {
            userId: player.userId,
            username: player.username,
            animaName: player.animaName?.trim() || "Anima",
            animaLevel: Math.max(1, player.animaLevel ?? 1),
            animaImageData,
            animaFlipHorizontal: player.animaFlipHorizontal !== false,
            animaSpriteScale: Math.max(player.animaSpriteScale ?? 3, 0.1),
            tileX: player.tileX,
            tileY: player.tileY,
            scaleX: player.scaleX,
            scaleY: player.scaleY,
            facingX,
            updatedAtMs: Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : Date.now(),
          });
        }
        otherPlayersRef.current = nextMap;
      } catch {
        // Presence sync is best-effort.
      }
    };

    void syncPlayers();
    const intervalId = window.setInterval(() => {
      void syncPlayers();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mapData?.id]);

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
    if (!mapData) {
      return;
    }

    const heartbeat = window.setInterval(() => {
      const player = playerRef.current;
      void persistState(player.tileX, player.tileY, player.scaleX, player.scaleY);
    }, 2500);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [mapData?.id, persistState]);

  useEffect(() => {
    if (!mapData) {
      enemyGroupsRef.current = new Map();
      enemiesRef.current = [];
      otherPlayersRef.current = new Map();
      damageTextsRef.current = [];
      rewardTextsRef.current = [];
      attackEffectsRef.current = [];
      groundDropsRef.current = [];
      dropImageMapRef.current = new Map();
      collectingDropIdRef.current = null;
      selectedEnemyIdRef.current = null;
      engagedEnemyIdRef.current = null;
      activePortalIdRef.current = null;
      suppressPortalPromptUntilLeaveRef.current = true;
      setPortalPrompt(null);
      cancelTracking();
      setCanvasCursorMode("default");
      return;
    }

    rebuildEnemies(mapData);
  }, [cancelTracking, mapData, rebuildEnemies, setCanvasCursorMode]);

  useEffect(() => {
    const onConsumableUsed = (
      event: Event & {
        detail?: {
          currentHp: number;
          totalMaxHp: number;
          bonusAttackAdded: number;
          bonusDefenseAdded: number;
        };
      },
    ) => {
      const detail = event.detail;
      if (!detail) {
        return;
      }

      playerRef.current.maxHp = Math.max(1, detail.totalMaxHp);
      playerRef.current.hp = clamp(detail.currentHp, 0, playerRef.current.maxHp);
      playerRef.current.attack = Math.max(1, playerRef.current.attack + detail.bonusAttackAdded);
      playerRef.current.defense = Math.max(0, playerRef.current.defense + detail.bonusDefenseAdded);
    };

    window.addEventListener("explore:consumable-used", onConsumableUsed as EventListener);
    return () => {
      window.removeEventListener("explore:consumable-used", onConsumableUsed as EventListener);
    };
  }, []);

  useEffect(() => {
    const onQuestChanged = () => {
      void refreshQuestState();
    };

    window.addEventListener("quest:changed", onQuestChanged as EventListener);
    return () => {
      window.removeEventListener("quest:changed", onQuestChanged as EventListener);
    };
  }, [refreshQuestState]);

  useEffect(() => {
    groundDropsRef.current = [];
    rewardTextsRef.current = [];
    levelUpAuraRef.current = null;
    dropImageMapRef.current = new Map();
    collectingDropIdRef.current = null;
    setNpcInteractionState(null);
    setNpcConversationState(null);
    setNpcShopState(null);
  }, [mapData?.id]);

  useEffect(() => {
    if (!spriteData) {
      spriteImageRef.current = null;
      spriteFramesRef.current = null;
      spriteAnimationRef.current = { index: 0, lastAt: 0, elapsed: 0 };
      return;
    }

    const asset = createSpriteAsset(spriteData);
    spriteFramesRef.current = asset.frames;
    spriteImageRef.current = asset.image;
    spriteAnimationRef.current = asset.animation;
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
    if (!mapData) {
      enemySpriteMapRef.current = new Map();
      return;
    }

    const nextMap = new Map<string, SpriteAsset>();
    for (const enemyGroup of mapData.enemySpawns) {
      if (!enemyGroup.imageData) {
        continue;
      }
      nextMap.set(enemyGroup.id, createSpriteAsset(enemyGroup.imageData));
    }
    enemySpriteMapRef.current = nextMap;
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
      const navigationLayer = buildNavigationCollisionLayer(map);
      if (!playerRef.current.moving) {
        const currentTile = { x: playerRef.current.tileX, y: playerRef.current.tileY };
        if (!isWalkableForPlayer(map, currentTile, navigationLayer)) {
          const nearestWalkable = findNearestWalkableTile(currentTile, navigationLayer);
          if (nearestWalkable) {
            playerRef.current.tileX = nearestWalkable.x;
            playerRef.current.tileY = nearestWalkable.y;
            playerRef.current.renderX = nearestWalkable.x;
            playerRef.current.renderY = nearestWalkable.y;
            playerRef.current.fromX = nearestWalkable.x;
            playerRef.current.fromY = nearestWalkable.y;
            playerRef.current.toX = nearestWalkable.x;
            playerRef.current.toY = nearestWalkable.y;
            routeRef.current = [];
            routeAllowsCornerCutRef.current = false;
            hoverTargetRef.current = null;
            suppressPortalPromptUntilLeaveRef.current = true;
            cancelTracking();
            void persistState(
              nearestWalkable.x,
              nearestWalkable.y,
              playerRef.current.scaleX,
              playerRef.current.scaleY,
            );
          }
        }
      }
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
          if (portalPromptRef.current && !teleportingRef.current) {
            suppressPortalPromptUntilLeaveRef.current = true;
            setPortalPrompt(null);
          }
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
            if (portalPromptRef.current && !teleportingRef.current) {
              suppressPortalPromptUntilLeaveRef.current = true;
              setPortalPrompt(null);
            }
            const next = { x: playerRef.current.tileX + dx, y: playerRef.current.tileY + dy };
            cancelTracking();
            if (tryStartMove(next)) {
              routeRef.current = [];
              routeAllowsCornerCutRef.current = false;
            }
          }
        }
      }

      const validDrops: GroundDrop[] = [];
      for (const drop of groundDropsRef.current) {
        if (now < drop.expiresAt || drop.collecting) {
          validDrops.push(drop);
        } else {
          dropImageMapRef.current.delete(drop.id);
          if (collectingDropIdRef.current === drop.id) {
            collectingDropIdRef.current = null;
          }
        }
      }
      groundDropsRef.current = validDrops;

      const collectingDropId = collectingDropIdRef.current;
      if (collectingDropId && !playerRef.current.moving) {
        const targetDrop = groundDropsRef.current.find((drop) => drop.id === collectingDropId) ?? null;
        if (!targetDrop) {
          collectingDropIdRef.current = null;
        } else {
          const playerTile = { x: playerRef.current.tileX, y: playerRef.current.tileY };
          const targetTile = { x: targetDrop.tileX, y: targetDrop.tileY };
          if (pointsEqual(playerTile, targetTile)) {
            if (!targetDrop.collecting) {
              targetDrop.collecting = true;
              void collectInventoryDrop(targetDrop.itemId, targetDrop.quantity)
                .then(() => {
                  groundDropsRef.current = groundDropsRef.current.filter((drop) => drop.id !== targetDrop.id);
                  dropImageMapRef.current.delete(targetDrop.id);
                  if (collectingDropIdRef.current === targetDrop.id) {
                    collectingDropIdRef.current = null;
                  }
                })
                .catch((error) => {
                  targetDrop.collecting = false;
                  collectingDropIdRef.current = null;
                  if (error instanceof ApiError) {
                    setErrorMessage(error.message);
                  } else {
                    setErrorMessage("Falha ao coletar drop.");
                  }
                });
            }
          } else if (routeRef.current.length === 0) {
            const navigationLayer = buildNavigationCollisionLayer(map);
            const pathLayer = navigationLayer.map((row) => row.slice());
            pathLayer[playerTile.y][playerTile.x] = false;
            const path = findPathAStar(playerTile, targetTile, pathLayer, { allowCornerCut: true });
            if (path.length > 1) {
              routeRef.current = path.slice(1);
              routeAllowsCornerCutRef.current = true;
            } else {
              collectingDropIdRef.current = null;
            }
          }
        }
      }

      const trackingEnemyId = playerRef.current.trackingEnemyId;
      if (trackingEnemyId && !playerRef.current.moving) {
        const targetEnemy = enemiesRef.current.find(
          (enemy) => enemy.id === trackingEnemyId && enemy.spawned && enemy.deathStartedAt === 0,
        );
        if (!targetEnemy) {
          cancelTracking();
        } else {
          const playerPoint = { x: playerRef.current.tileX, y: playerRef.current.tileY };
          const enemyPoint = { x: targetEnemy.tileX, y: targetEnemy.tileY };
          const inRange = isAdjacentTile(playerPoint, enemyPoint);
          if (targetEnemy.renderX > playerRef.current.renderX + 0.01) {
            playerRef.current.facingX = 1;
          } else if (targetEnemy.renderX < playerRef.current.renderX - 0.01) {
            playerRef.current.facingX = -1;
          }
          if (playerRef.current.renderX > targetEnemy.renderX + 0.01) {
            targetEnemy.facingX = 1;
          } else if (playerRef.current.renderX < targetEnemy.renderX - 0.01) {
            targetEnemy.facingX = -1;
          }

          if (inRange) {
            if (now - playerRef.current.lastAttackAt >= playerRef.current.attackIntervalMs) {
              playerRef.current.lastAttackAt = now;
              engagedEnemyIdRef.current = targetEnemy.id;
              for (const enemy of enemiesRef.current) {
                if (enemy.id !== targetEnemy.id) {
                  enemy.aggroUntilAt = 0;
                  enemy.route = [];
                }
              }
              const damage = rollDamage(playerRef.current.attack, targetEnemy.defense, playerRef.current.critChance);
              targetEnemy.hp = Math.max(0, targetEnemy.hp - damage.value);
              targetEnemy.hitFlashUntil = now + 130;
              const fromWorldX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
              const fromWorldY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.5;
              const toWorldX = targetEnemy.renderX * TILE_SIZE + TILE_SIZE / 2;
              const toWorldY = targetEnemy.renderY * TILE_SIZE + TILE_SIZE * 0.5;
              const lungeDistance = Math.hypot(toWorldX - fromWorldX, toWorldY - fromWorldY) || 1;
              playerRef.current.attackLungeDx = (toWorldX - fromWorldX) / lungeDistance;
              playerRef.current.attackLungeDy = (toWorldY - fromWorldY) / lungeDistance;
              playerRef.current.attackLungeDistance = clamp(lungeDistance * 0.42, 6, 20);
              playerRef.current.attackLungeUntil = now + ATTACK_LUNGE_DURATION_MS;
              targetEnemy.aggroUntilAt = now + ENEMY_AGGRO_DURATION_MS;
              pushAttackEffect(
                playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2,
                playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.35,
                targetEnemy.renderX * TILE_SIZE + TILE_SIZE / 2,
                targetEnemy.renderY * TILE_SIZE + TILE_SIZE * 0.35,
                false,
                damage.critical,
              );
              pushDamageText(
                targetEnemy.renderX * TILE_SIZE + TILE_SIZE / 2,
                targetEnemy.renderY * TILE_SIZE + TILE_SIZE * 0.25,
                damage.value,
                damage.critical,
                false,
              );

              if (targetEnemy.hp <= 0) {
                targetEnemy.hp = 0;
                targetEnemy.route = [];
                targetEnemy.moving = false;
                const droppedItems = spawnGroundDropsForEnemy(targetEnemy, now);
                const targetEnemyGroup = enemyGroupsRef.current.get(targetEnemy.groupId);
                if (targetEnemyGroup) {
                  void registerEnemyDefeat({
                    bestiaryAnimaId: targetEnemyGroup.bestiaryAnimaId,
                    droppedItems,
                  })
                    .then((reward) => {
                      const previousLevel = playerRef.current.level;
                      playerRef.current.level = Math.max(1, reward.level);
                      playerRef.current.experience = Math.max(0, reward.experience);
                      playerRef.current.experienceMax = Math.max(1, reward.experienceMax);
                      const rewardX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
                      const rewardY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.1;
                      if (reward.xpGained > 0) {
                        pushRewardText(rewardX, rewardY, `+${reward.xpGained} XP`, "rgba(125, 211, 252, 1)", 0.98);
                      }
                      if (reward.bitsGained > 0) {
                        pushRewardText(rewardX + 2, rewardY + 14, `+${reward.bitsGained} Bits`, "rgba(253, 230, 138, 1)", 0.96);
                      }
                      if (reward.level > previousLevel) {
                        const nowLevelUp = performance.now();
                        levelUpAuraRef.current = { startedAt: nowLevelUp, ttlMs: 1700, level: reward.level };
                        triggerCameraShake(0.62, 280);
                        triggerScreenFlash(0.24, 180, "rgba(167, 243, 208, 1)");
                        impactRingsRef.current.push({
                          id: `${nowLevelUp}_level_ring`,
                          x: rewardX,
                          y: playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.45,
                          createdAt: nowLevelUp,
                          ttlMs: 820,
                          color: "rgba(74, 222, 128, 1)",
                          critical: true,
                        });
                        pushRewardText(rewardX, rewardY - 14, "Lv Up", "rgba(134, 239, 172, 1)", 1.02);
                      }
                      setActiveQuests(reward.activeQuests);
                    })
                    .catch((error) => {
                      if (error instanceof ApiError) {
                        setErrorMessage(error.message);
                      } else {
                        setErrorMessage("Falha ao aplicar recompensa de combate.");
                      }
                    });
                }
                targetEnemy.deathStartedAt = now;
                targetEnemy.aggroUntilAt = 0;
                if (selectedEnemyIdRef.current === targetEnemy.id) {
                  selectedEnemyIdRef.current = null;
                }
                if (engagedEnemyIdRef.current === targetEnemy.id) {
                  engagedEnemyIdRef.current = null;
                }
                if (playerRef.current.trackingEnemyId === targetEnemy.id) {
                  cancelTracking();
                }
              }
            }
          } else if (now >= playerRef.current.nextTrackingPathAt && routeRef.current.length === 0) {
            const navigationLayer = buildNavigationCollisionLayer(map);
            const destinations: GridPoint[] = [];
            for (const direction of enemyDirections) {
              const tile = { x: enemyPoint.x + direction.x, y: enemyPoint.y + direction.y };
              if (isWalkableForPlayer(map, tile, navigationLayer)) {
                destinations.push(tile);
              }
            }

            if (destinations.length === 0 && isWalkableForPlayer(map, enemyPoint, navigationLayer)) {
              destinations.push(enemyPoint);
            }

            let bestPath: GridPoint[] = [];
            const pathLayer = navigationLayer.map((row) => row.slice());
            pathLayer[playerPoint.y][playerPoint.x] = false;
            for (const destination of destinations) {
              const route = findPathAStar(playerPoint, destination, pathLayer, { allowCornerCut: true });
              if (route.length > 1 && (bestPath.length === 0 || route.length < bestPath.length)) {
                bestPath = route;
              }
            }

            if (bestPath.length > 1) {
              routeRef.current = bestPath.slice(1);
              routeAllowsCornerCutRef.current = true;
            }
            playerRef.current.nextTrackingPathAt = now + 140;
          }
        }
      }

      if (engagedEnemyIdRef.current) {
        const engagedEnemy = enemiesRef.current.find(
          (enemy) => enemy.id === engagedEnemyIdRef.current && enemy.spawned && enemy.deathStartedAt === 0,
        );
        if (!engagedEnemy) {
          engagedEnemyIdRef.current = null;
        } else {
          if (engagedEnemy.renderX > playerRef.current.renderX + 0.01) {
            playerRef.current.facingX = 1;
          } else if (engagedEnemy.renderX < playerRef.current.renderX - 0.01) {
            playerRef.current.facingX = -1;
          }
          if (playerRef.current.renderX > engagedEnemy.renderX + 0.01) {
            engagedEnemy.facingX = 1;
          } else if (playerRef.current.renderX < engagedEnemy.renderX - 0.01) {
            engagedEnemy.facingX = -1;
          }
          if (now >= engagedEnemy.aggroUntilAt && playerRef.current.trackingEnemyId !== engagedEnemy.id) {
            engagedEnemyIdRef.current = null;
          }
        }
      }

      const isTileOccupiedByOtherEnemy = (enemyId: string, tileX: number, tileY: number) =>
        enemiesRef.current.some((other) => {
          if (other.id === enemyId || !other.spawned || other.deathStartedAt > 0) {
            return false;
          }

          const occupiesCurrent = other.tileX === tileX && other.tileY === tileY;
          const occupiesTarget = other.moving && other.toX === tileX && other.toY === tileY;
          return occupiesCurrent || occupiesTarget;
        });

      const canEnemyUseTile = (enemy: EnemyRuntime, group: EnemyGroupRuntime, tileX: number, tileY: number) => {
        if (tileX < 0 || tileX >= map.cols || tileY < 0 || tileY >= map.rows) {
          return false;
        }
        if (group.movementCollisionLayer[tileY]?.[tileX] === true) {
          return false;
        }
        if (isTileOccupiedByOtherEnemy(enemy.id, tileX, tileY)) {
          return false;
        }
        return true;
      };

      const startEnemyStep = (enemy: EnemyRuntime, group: EnemyGroupRuntime, next: GridPoint, speedMultiplier = 1) => {
        if (!canEnemyUseTile(enemy, group, next.x, next.y)) {
          enemy.route = [];
          enemy.nextDecisionAt = now + 110;
          return false;
        }

        const dx = next.x - enemy.tileX;
        const dy = next.y - enemy.tileY;
        if (dx > 0) {
          enemy.facingX = 1;
        } else if (dx < 0) {
          enemy.facingX = -1;
        }
        enemy.moving = true;
        enemy.fromX = enemy.tileX;
        enemy.fromY = enemy.tileY;
        enemy.toX = next.x;
        enemy.toY = next.y;
        enemy.moveStartedAt = now;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const speed = Math.max(group.movementSpeed * speedMultiplier, 0.25);
        enemy.moveDurationMs = clamp((distance / speed) * 1000, 90, 1400);
        return true;
      };

      for (const enemy of enemiesRef.current) {
        const group = enemyGroupsRef.current.get(enemy.groupId);
        if (!group) {
          continue;
        }

        if (enemy.deathStartedAt > 0) {
          const deathProgress = clamp((now - enemy.deathStartedAt) / ENEMY_DEATH_DURATION_MS, 0, 1);
          if (deathProgress >= 1) {
            if (engagedEnemyIdRef.current === enemy.id) {
              engagedEnemyIdRef.current = null;
            }
            enemy.deathStartedAt = 0;
            enemy.spawned = false;
            enemy.respawnAt = now + group.respawnMs;
            enemy.hp = enemy.maxHp;
            enemy.route = [];
          }
          continue;
        }

        if (!enemy.spawned) {
          if (now >= enemy.respawnAt) {
            const spawnCandidates = [...group.spawnTiles, ...group.movementTiles].filter((tile) => canEnemyUseTile(enemy, group, tile.x, tile.y));
            const spawnTile = pickRandom(spawnCandidates);
            if (spawnTile) {
              enemy.spawned = true;
              enemy.tileX = spawnTile.x;
              enemy.tileY = spawnTile.y;
              enemy.renderX = spawnTile.x;
              enemy.renderY = spawnTile.y;
              enemy.hp = enemy.maxHp;
              enemy.route = [];
              enemy.facingX = -1;
              enemy.aggroUntilAt = 0;
              enemy.lastAttackAt = 0;
              enemy.spawnFxUntil = now + ENEMY_SPAWN_PORTAL_MS;
              enemy.nextDecisionAt = now + 350 + Math.random() * 900;
            } else {
              enemy.respawnAt = now + group.respawnMs;
            }
          }
          continue;
        }

        if (playerRef.current.trackingEnemyId === enemy.id) {
          engagedEnemyIdRef.current = enemy.id;
          enemy.aggroUntilAt = now + ENEMY_AGGRO_DURATION_MS;
        }
        if (engagedEnemyIdRef.current && enemy.id !== engagedEnemyIdRef.current && enemy.aggroUntilAt > 0) {
          enemy.aggroUntilAt = 0;
          enemy.route = [];
        }
        const isAggro = engagedEnemyIdRef.current === enemy.id && now < enemy.aggroUntilAt;
        if (isAggro) {
          if (playerRef.current.renderX > enemy.renderX + 0.01) {
            enemy.facingX = 1;
          } else if (playerRef.current.renderX < enemy.renderX - 0.01) {
            enemy.facingX = -1;
          }
        }

        if (enemy.moving) {
          if (!canEnemyUseTile(enemy, group, enemy.toX, enemy.toY)) {
            enemy.moving = false;
            enemy.route = [];
            enemy.toX = enemy.tileX;
            enemy.toY = enemy.tileY;
            enemy.renderX = enemy.tileX;
            enemy.renderY = enemy.tileY;
            enemy.nextDecisionAt = now + 90;
            continue;
          }

          const t = clamp((now - enemy.moveStartedAt) / enemy.moveDurationMs, 0, 1);
          enemy.renderX = enemy.fromX + (enemy.toX - enemy.fromX) * t;
          enemy.renderY = enemy.fromY + (enemy.toY - enemy.fromY) * t;
          if (t >= 1) {
            if (!canEnemyUseTile(enemy, group, enemy.toX, enemy.toY)) {
              enemy.moving = false;
              enemy.route = [];
              enemy.toX = enemy.tileX;
              enemy.toY = enemy.tileY;
              enemy.renderX = enemy.tileX;
              enemy.renderY = enemy.tileY;
              enemy.nextDecisionAt = now + 100;
              continue;
            }
            enemy.moving = false;
            enemy.tileX = enemy.toX;
            enemy.tileY = enemy.toY;
            enemy.renderX = enemy.toX;
            enemy.renderY = enemy.toY;
          }
          continue;
        }

        const playerTile = { x: playerRef.current.tileX, y: playerRef.current.tileY };
        const enemyTile = { x: enemy.tileX, y: enemy.tileY };
        const inRangeForAttack = isAdjacentTile(enemyTile, playerTile);
        const enemyHpRatio = toHealthRatio(enemy.hp, enemy.maxHp);
        const shouldFlee = isAggro && enemyHpRatio <= ENEMY_LOW_HP_RATIO_TO_FLEE;

        if (isAggro && !shouldFlee && inRangeForAttack && now - enemy.lastAttackAt >= enemy.attackIntervalMs) {
          enemy.lastAttackAt = now;
          const damage = rollDamage(enemy.attack, playerRef.current.defense, enemy.critChance);
          playerRef.current.hp = clamp(playerRef.current.hp - damage.value, 1, playerRef.current.maxHp);
          playerRef.current.hitFlashUntil = now + 130;
          const fromWorldX = enemy.renderX * TILE_SIZE + TILE_SIZE / 2;
          const fromWorldY = enemy.renderY * TILE_SIZE + TILE_SIZE * 0.5;
          const toWorldX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
          const toWorldY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.5;
          const lungeDistance = Math.hypot(toWorldX - fromWorldX, toWorldY - fromWorldY) || 1;
          enemy.attackLungeDx = (toWorldX - fromWorldX) / lungeDistance;
          enemy.attackLungeDy = (toWorldY - fromWorldY) / lungeDistance;
          enemy.attackLungeDistance = clamp(lungeDistance * 0.42, 6, 20);
          enemy.attackLungeUntil = now + ATTACK_LUNGE_DURATION_MS;
          pushAttackEffect(
            enemy.renderX * TILE_SIZE + TILE_SIZE / 2,
            enemy.renderY * TILE_SIZE + TILE_SIZE * 0.35,
            playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2,
            playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.35,
            true,
            damage.critical,
          );
          pushDamageText(
            playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2,
            playerRef.current.renderY * TILE_SIZE + TILE_SIZE * 0.15,
            damage.value,
            damage.critical,
            true,
          );
          enemy.nextDecisionAt = now + 120;
          continue;
        }

        const shouldOrbit = isAggro && !shouldFlee && inRangeForAttack && now - enemy.lastAttackAt < enemy.attackIntervalMs;

        if (shouldFlee && enemy.route.length > 0) {
          enemy.route = [];
        }

        if (enemy.route.length > 0) {
          const nextStep = enemy.route.shift();
          if (nextStep && canEnemyUseTile(enemy, group, nextStep.x, nextStep.y)) {
            const started = startEnemyStep(enemy, group, nextStep, isAggro ? ENEMY_COMBAT_SPEED_MULTIPLIER : 1);
            if (started) {
              continue;
            }
          } else if (nextStep) {
            enemy.route = [];
            enemy.nextDecisionAt = now + 90;
          }
          if (enemy.route.length > 0) {
            continue;
          }
          enemy.route = [];
          enemy.nextDecisionAt = now + 200;
        }

        if (now < enemy.nextDecisionAt && !isAggro) {
          continue;
        }

        const planRouteToDestination = (destinationCandidate: GridPoint, speedMultiplier = 1) => {
          const enemyStart = { x: enemy.tileX, y: enemy.tileY };
          const dynamicLayer = group.movementCollisionLayer.map((row) => row.slice());
          for (const other of enemiesRef.current) {
            if (other.id === enemy.id || !other.spawned || other.deathStartedAt > 0) {
              continue;
            }

            if (other.tileY >= 0 && other.tileY < map.rows && other.tileX >= 0 && other.tileX < map.cols) {
              dynamicLayer[other.tileY][other.tileX] = true;
            }
            if (other.moving && other.toY >= 0 && other.toY < map.rows && other.toX >= 0 && other.toX < map.cols) {
              dynamicLayer[other.toY][other.toX] = true;
            }
          }
          if (enemyStart.y >= 0 && enemyStart.y < map.rows && enemyStart.x >= 0 && enemyStart.x < map.cols) {
            dynamicLayer[enemyStart.y][enemyStart.x] = false;
          }

          let destination = destinationCandidate;
          if (dynamicLayer[destination.y]?.[destination.x] === true) {
            const adjusted = findNearestWalkableTile(destination, dynamicLayer);
            if (!adjusted || dynamicLayer[adjusted.y]?.[adjusted.x] === true) {
              return false;
            }
            destination = adjusted;
          }

          const route = findPathAStar(enemyStart, destination, dynamicLayer, { allowCornerCut: false });
          if (route.length <= 1) {
            return false;
          }
          enemy.route = route.slice(1);
          const nextStep = enemy.route.shift();
          if (!nextStep) {
            return false;
          }
          return startEnemyStep(enemy, group, nextStep, speedMultiplier);
        };

        if (isAggro) {
          if (shouldFlee) {
            const fleeCandidates = enemyDirections
              .map((direction) => ({ x: enemyTile.x + direction.x, y: enemyTile.y + direction.y }))
              .filter((candidate) => canEnemyUseTile(enemy, group, candidate.x, candidate.y))
              .sort((left, right) => {
                const leftDx = left.x - playerTile.x;
                const leftDy = left.y - playerTile.y;
                const rightDx = right.x - playerTile.x;
                const rightDy = right.y - playerTile.y;
                const leftDistance = leftDx * leftDx + leftDy * leftDy;
                const rightDistance = rightDx * rightDx + rightDy * rightDy;
                return rightDistance - leftDistance;
              });

            let escaped = false;
            if (fleeCandidates.length > 0) {
              escaped = planRouteToDestination(fleeCandidates[0], ENEMY_COMBAT_SPEED_MULTIPLIER);
            }

            if (!escaped) {
              const farDestinations = [...group.movementTiles]
                .sort((left, right) => {
                  const leftDx = left.x - playerTile.x;
                  const leftDy = left.y - playerTile.y;
                  const rightDx = right.x - playerTile.x;
                  const rightDy = right.y - playerTile.y;
                  const leftDistance = leftDx * leftDx + leftDy * leftDy;
                  const rightDistance = rightDx * rightDx + rightDy * rightDy;
                  return rightDistance - leftDistance;
                })
                .slice(0, 12);

              for (const destination of farDestinations) {
                if (planRouteToDestination(destination, ENEMY_COMBAT_SPEED_MULTIPLIER)) {
                  escaped = true;
                  break;
                }
              }
            }

            enemy.nextDecisionAt = now + (escaped ? 65 : 180);
            continue;
          }

          let chaseTarget: GridPoint | null = null;
          if (shouldOrbit) {
            const orbitCandidates = enemyDirections
              .map((direction) => ({ x: playerTile.x + direction.x, y: playerTile.y + direction.y }))
              .filter((candidate) => {
                if (candidate.x === enemyTile.x && candidate.y === enemyTile.y) return false;
                return canEnemyUseTile(enemy, group, candidate.x, candidate.y);
              });
            chaseTarget = pickRandom(orbitCandidates);
          }

          if (!chaseTarget) {
            chaseTarget =
              findNearestWalkableInArea(playerTile, group.movementArea, map.collisionLayer) ??
              findNearestWalkableTile(playerTile, group.movementCollisionLayer.map((row) => row.slice()));
          }

          if (!chaseTarget || !planRouteToDestination(chaseTarget, ENEMY_COMBAT_SPEED_MULTIPLIER)) {
            enemy.nextDecisionAt = now + (shouldOrbit ? 70 : 300);
          } else {
            enemy.nextDecisionAt = now + (shouldOrbit ? 55 : 90);
          }
          continue;
        }

        const desiredDestination = pickRandom(group.movementTiles);
        if (!desiredDestination) {
          enemy.nextDecisionAt = now + group.respawnMs;
          continue;
        }

        if (!planRouteToDestination(desiredDestination, 1)) {
          enemy.nextDecisionAt = now + 350 + Math.random() * 900;
        }
      }

      const standingPortal = (map.portals ?? []).find(
        (portal) => portal.area[playerRef.current.tileY]?.[playerRef.current.tileX] === true,
      );
      if (standingPortal) {
        if (suppressPortalPromptUntilLeaveRef.current) {
          activePortalIdRef.current = null;
        } else if (
          !suppressPortalPromptUntilLeaveRef.current &&
          activePortalIdRef.current !== standingPortal.id &&
          !portalPromptRef.current &&
          !teleportingRef.current
        ) {
          setPortalPrompt({
            portalId: standingPortal.id,
            targetMapName: standingPortal.targetMapName ?? "Mapa de destino",
            targetSpawnX: standingPortal.targetSpawnX,
            targetSpawnY: standingPortal.targetSpawnY,
          });
        }
        activePortalIdRef.current = standingPortal.id;
      } else {
        activePortalIdRef.current = null;
        suppressPortalPromptUntilLeaveRef.current = false;
        if (portalPromptRef.current && !teleportingRef.current) {
          setPortalPrompt(null);
        }
      }

      const playerWorldX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
      const playerWorldY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE / 2;
      const baseCameraX = playerWorldX - width / 2;
      const baseCameraY = playerWorldY - height / 2;

      let shakeX = 0;
      let shakeY = 0;
      const shake = cameraShakeRef.current;
      if (shake) {
        const t = clamp((now - shake.startedAt) / shake.ttlMs, 0, 1);
        const fade = 1 - t;
        const amplitude = 8.5 * shake.strength * fade;
        shakeX = Math.sin(now * 0.035 + 1.1) * amplitude;
        shakeY = Math.cos(now * 0.041 + 0.3) * amplitude * 0.7;
        if (t >= 1) {
          cameraShakeRef.current = null;
        }
      }

      const cameraX = baseCameraX + shakeX;
      const cameraY = baseCameraY + shakeY;
      cameraRef.current = { x: cameraX, y: cameraY, width, height };

      context.fillStyle = "rgba(15, 15, 15, 1)";
      context.fillRect(0, 0, width, height);
      context.save();
      context.translate(-cameraX, -cameraY);

      context.fillStyle = "#050814";
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

      const viewStartTileX = Math.floor(cameraX / TILE_SIZE) - 2;
      const viewEndTileX = Math.ceil((cameraX + width) / TILE_SIZE) + 2;
      const viewStartTileY = Math.floor(cameraY / TILE_SIZE) - 2;
      const viewEndTileY = Math.ceil((cameraY + height) / TILE_SIZE) + 2;

      context.save();
      context.lineWidth = 1;
      for (let tileY = viewStartTileY; tileY <= viewEndTileY; tileY += 1) {
        for (let tileX = viewStartTileX; tileX <= viewEndTileX; tileX += 1) {
          if (tileX >= 0 && tileX < map.cols && tileY >= 0 && tileY < map.rows) {
            continue;
          }

          const worldX = tileX * TILE_SIZE;
          const worldY = tileY * TILE_SIZE;
          const withinHorizontal = worldX < map.worldWidth && worldX + TILE_SIZE > 0;
          const withinVertical = worldY < map.worldHeight && worldY + TILE_SIZE > 0;
          if (!withinHorizontal && !withinVertical) {
            // Still draw beyond world bounds to cover full viewport
          }

          const baseAlpha = 0.5;
          context.fillStyle = `rgba(9, 9, 11, ${baseAlpha})`;
          context.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

          context.strokeStyle = "rgba(30, 64, 175, 0.22)";
          context.strokeRect(worldX + 0.5, worldY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

          context.strokeStyle = "rgba(15, 23, 42, 0.9)";
          const cx = worldX + TILE_SIZE / 2;
          const cy = worldY + TILE_SIZE / 2;
          const crossSize = TILE_SIZE * 0.18;
          context.beginPath();
          context.moveTo(cx - crossSize, cy);
          context.lineTo(cx + crossSize, cy);
          context.moveTo(cx, cy - crossSize);
          context.lineTo(cx, cy + crossSize);
          context.stroke();
        }
      }
      context.restore();

      if ((map.portals ?? []).length > 0) {
        for (const portal of map.portals) {
          const isActivePortal = portal.id === activePortalIdRef.current;
          const wave = (Math.sin(now / 240) + 1) * 0.5;
          const spin = now / 520;
          const glowAlpha = isActivePortal ? 0.22 + wave * 0.22 : 0.12 + wave * 0.14;
          const ringAlpha = isActivePortal ? 0.62 + wave * 0.3 : 0.34 + wave * 0.22;
          const tileCenters: Array<{ x: number; y: number }> = [];

          for (let y = 0; y < map.rows; y += 1) {
            for (let x = 0; x < map.cols; x += 1) {
              if (portal.area[y]?.[x] !== true) continue;
              const worldX = x * TILE_SIZE;
              const worldY = y * TILE_SIZE;
              context.fillStyle = `rgba(99, 102, 241, ${glowAlpha})`;
              context.fillRect(worldX + 1, worldY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
              tileCenters.push({ x: worldX + TILE_SIZE / 2, y: worldY + TILE_SIZE / 2 });
            }
          }

          for (const center of tileCenters) {
            const radius = 5.2 + wave * 2.3;
            context.save();
            context.translate(center.x, center.y);
            context.rotate(spin);
            context.strokeStyle = `rgba(165, 180, 252, ${ringAlpha})`;
            context.lineWidth = isActivePortal ? 1.7 : 1.3;
            context.setLineDash([6, 4]);
            context.lineDashOffset = -(now / 35);
            context.beginPath();
            context.ellipse(0, 0, radius, radius * 0.58, 0, 0, Math.PI * 2);
            context.stroke();
            context.setLineDash([]);
            context.beginPath();
            context.fillStyle = `rgba(129, 140, 248, ${0.35 + wave * 0.25})`;
            context.arc(0, 0, 1.8 + wave * 0.7, 0, Math.PI * 2);
            context.fill();
            context.restore();
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
        const hasTargetLock = Boolean(playerRef.current.trackingEnemyId || collectingDropIdRef.current);
        const routePulse = 0.7 + (Math.sin(now / 120) + 1) * 0.15;
        context.strokeStyle = hasTargetLock ? `rgba(248, 113, 113, ${routePulse})` : "rgba(226, 232, 240, 0.5)";
        context.lineWidth = hasTargetLock ? 2.25 : 1.75;
        context.setLineDash(hasTargetLock ? [9, 7] : [7, 10]);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2, playerRef.current.renderY * TILE_SIZE + TILE_SIZE / 2);
        for (const point of routeRef.current) {
          context.lineTo(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2);
        }
        context.stroke();
        context.setLineDash([]);

        context.fillStyle = hasTargetLock ? "rgba(248, 113, 113, 0.82)" : "rgba(148, 163, 184, 0.55)";
        for (const point of routeRef.current) {
          context.beginPath();
          context.arc(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2, hasTargetLock ? 2.45 : 1.8, 0, Math.PI * 2);
          context.fill();
        }

        const last = routeRef.current[routeRef.current.length - 1];
        if (last) {
          const tileX = last.x * TILE_SIZE;
          const tileY = last.y * TILE_SIZE;
          context.fillStyle = hasTargetLock ? "rgba(248, 113, 113, 0.12)" : "rgba(226, 232, 240, 0.08)";
          context.fillRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
          context.strokeStyle = hasTargetLock ? "rgba(248, 113, 113, 0.95)" : "rgba(226, 232, 240, 0.82)";
          context.lineWidth = hasTargetLock ? 1.9 : 1.35;
          context.strokeRect(tileX + 0.5, tileY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      }

      const enemyGroupFrameMap = new Map<string, CanvasImageSource | null>();
      for (const [groupId, asset] of enemySpriteMapRef.current.entries()) {
        const animatedFrame = resolveSpriteFrame(asset.frames, asset.animation, now);
        const staticImage = asset.image && asset.image.complete ? asset.image : null;
        enemyGroupFrameMap.set(groupId, animatedFrame ?? staticImage);
      }

      let playerSprite: CanvasImageSource | null = resolveSpriteFrame(spriteFramesRef.current, spriteAnimationRef.current, now);
      if (!playerSprite && spriteImageRef.current?.complete) {
        playerSprite = spriteImageRef.current;
      }

      type RenderableEntity = {
        depth: number;
        order: number;
        draw: () => void;
      };

      const entities: RenderableEntity[] = [];
      let entityOrder = 0;

      for (const drop of groundDropsRef.current) {
        if (drop.collecting) {
          continue;
        }

        const sprite = drop.imageData ? dropImageMapRef.current.get(drop.id) ?? null : null;
        const lifeRatio = clamp((drop.expiresAt - now) / DROP_TTL_MS, 0, 1);
        const blink = lifeRatio < 0.25 ? (Math.sin(now / 70) + 1) * 0.5 : 1;
        const alpha = clamp(0.35 + lifeRatio * 0.65, 0.25, 1) * blink;
        const bob = Math.sin((now - drop.spawnedAt) / 170) * 1.8;
        const drawSize = DROP_DRAW_SIZE;
        const centerX = drop.worldX;
        const baseY = drop.worldY;

        entities.push({
          depth: baseY,
          order: entityOrder,
          draw: () => {
            context.save();
            context.globalAlpha = 0.28 * alpha;
            context.fillStyle = "rgba(0,0,0,1)";
            context.beginPath();
            context.ellipse(centerX, baseY + 2.2, drawSize * 0.32, drawSize * 0.14, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();

            context.save();
            context.globalAlpha = alpha;
            if (sprite && sprite.complete) {
              context.drawImage(sprite, centerX - drawSize / 2, baseY - drawSize + bob, drawSize, drawSize);
            } else {
              context.fillStyle = "rgba(191, 219, 254, 0.95)";
              context.fillRect(centerX - drawSize / 2, baseY - drawSize + bob, drawSize, drawSize);
            }
            context.restore();

            if (drop.quantity > 1) {
              context.save();
              context.font = "700 10px Geist, sans-serif";
              context.textAlign = "center";
              context.textBaseline = "middle";
              context.fillStyle = "rgba(248, 250, 252, 0.98)";
              context.strokeStyle = "rgba(2, 6, 23, 0.95)";
              context.lineWidth = 3.2;
              const text = `x${drop.quantity}`;
              context.strokeText(text, centerX, baseY - drawSize + 2 + bob);
              context.fillText(text, centerX, baseY - drawSize + 2 + bob);
              context.restore();
            }
          },
        });
        entityOrder += 1;
      }

      for (const otherPlayer of otherPlayersRef.current.values()) {
        if (now - otherPlayer.updatedAtMs > 20_000) {
          continue;
        }

        const centerX = otherPlayer.tileX * TILE_SIZE + TILE_SIZE / 2;
        const baseY = otherPlayer.tileY * TILE_SIZE + TILE_SIZE;
        const label = otherPlayer.username;
        const bodyScale = clamp((otherPlayer.scaleX + otherPlayer.scaleY) / 2, 1.8, 3.2);
        const bodyHeight = 16 * (bodyScale / 3);
        const bodyWidth = 12 * (bodyScale / 3);

        entities.push({
          depth: baseY,
          order: entityOrder,
          draw: () => {
            const breath = getIdleBreath(now, otherPlayer.tileX * 0.33 + otherPlayer.tileY * 0.57, true);
            context.save();
            context.fillStyle = "rgba(2, 6, 23, 0.32)";
            context.beginPath();
            context.ellipse(centerX, baseY - 2, Math.max(6, bodyWidth * 0.8), 3.2, 0, 0, Math.PI * 2);
            context.fill();

            context.save();
            context.translate(centerX, baseY - breath.bobY);
            context.scale(breath.scaleX, breath.scaleY);
            context.fillStyle = "rgba(148, 163, 184, 0.92)";
            context.fillRect(-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight * 0.78);
            context.fillStyle = "rgba(226, 232, 240, 0.96)";
            context.beginPath();
            context.arc(0, -bodyHeight - 2.8, bodyWidth * 0.36, 0, Math.PI * 2);
            context.fill();
            context.restore();

            context.font = "600 10px Geist, sans-serif";
            const textWidth = Math.min(120, Math.max(42, context.measureText(label).width + 14));
            const boxX = centerX - textWidth / 2;
            const boxY = baseY - bodyHeight - 19;
            drawRoundedRect(context, boxX, boxY, textWidth, 13, 4);
            context.fillStyle = "rgba(2, 6, 23, 0.8)";
            context.fill();
            context.strokeStyle = "rgba(148, 163, 184, 0.42)";
            context.lineWidth = 1;
            context.stroke();

            context.fillStyle = "rgba(248, 250, 252, 0.96)";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(label, centerX, boxY + 6.5);
            context.restore();
          },
        });
        entityOrder += 1;
      }

      for (const npc of activeMapNpcs) {
        const centerX = npc.tileX * TILE_SIZE + TILE_SIZE / 2;
        const baseY = npc.tileY * TILE_SIZE + TILE_SIZE;
        const width = Math.max(8, npc.width ?? 96);
        const height = Math.max(8, npc.height ?? 96);
        const asset = npcSpriteMapRef.current.get(npc.id) ?? null;
        const npcDialogs = npc.npc?.dialogs ?? [];
        const availableQuestTypes = npcDialogs
          .filter((dialog) => dialog.actionType === "QUEST" && dialog.quest && isQuestDialogAvailable(npc.npcId, dialog))
          .map((dialog) => normalizeQuestType(dialog.quest?.questType));
        const turnInQuestTypes = turnInQuestTypesByNpc.get(npc.npcId) ?? [];
        const questMarkers = [
          ...availableQuestTypes.map((questType) => ({ questType, symbol: "!" as const })),
          ...turnInQuestTypes.map((questType) => ({ questType, symbol: "?" as const })),
        ];
        const hasShop = npcDialogs.some((dialog) => dialog.actionType === "SHOP_BUY" || dialog.actionType === "SHOP_CRAFT");
        const markerCount = questMarkers.length + (hasShop ? 1 : 0);

        entities.push({
          depth: baseY,
          order: entityOrder,
          draw: () => {
            context.save();
            context.fillStyle = "rgba(2, 6, 23, 0.34)";
            context.beginPath();
            context.ellipse(centerX, baseY - 2, Math.max(6, width * 0.2), Math.max(3, width * 0.08), 0, 0, Math.PI * 2);
            context.fill();

            const npcSprite = asset ? resolveSpriteFrame(asset.frames, asset.animation, now) ?? asset.image : null;
            const npcBreath = getIdleBreath(now, npc.tileX * 0.29 + npc.tileY * 0.71, !asset?.frames);
            if (npcSprite) {
              context.save();
              context.translate(centerX, baseY - npcBreath.bobY);
              context.scale(npcBreath.scaleX, npcBreath.scaleY);
              context.drawImage(npcSprite, -width / 2, -height, width, height);
              context.restore();
            } else {
              context.fillStyle = "rgba(148, 163, 184, 0.9)";
              context.save();
              context.translate(centerX, baseY - npcBreath.bobY);
              context.scale(npcBreath.scaleX, npcBreath.scaleY);
              context.fillRect(-width / 2, -height, width, height);
              context.restore();
            }

            const label = npc.npc?.name ?? npc.npcName ?? "NPC";
            context.font = "600 10px Geist, sans-serif";
            const labelWidth = Math.max(44, context.measureText(label).width + 14);
            const labelX = centerX - labelWidth / 2;
            const labelY = baseY - height - 18;

            if (markerCount > 0) {
              const markerSize = 8;
              const gap = 5;
              const rowWidth = markerCount * (markerSize * 2) + (markerCount - 1) * gap;
              let cursorX = centerX - rowWidth / 2 + markerSize;
              const markerY = labelY - 9;
              let markerIndex = 0;
              for (const marker of questMarkers) {
                const questType = marker.questType;
                const visual = questTypeVisualMap[questType];
                const pulse = 0.88 + Math.sin(now / 240 + markerIndex * 0.7) * 0.1;
                const markerRadius = markerSize * pulse;
                context.beginPath();
                context.arc(cursorX, markerY, markerRadius, 0, Math.PI * 2);
                context.fillStyle = visual.color;
                context.fill();
                context.lineWidth = 1.4;
                context.strokeStyle = "rgba(15, 23, 42, 0.85)";
                context.stroke();
                context.save();
                context.globalAlpha = 0.24;
                context.beginPath();
                context.arc(cursorX, markerY, markerRadius + 3, 0, Math.PI * 2);
                context.fillStyle = visual.color;
                context.fill();
                context.restore();
                context.fillStyle = "rgba(248, 250, 252, 0.96)";
                context.font = "900 11px Geist, sans-serif";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(marker.symbol, cursorX, markerY + 0.5);
                cursorX += markerSize * 2 + gap;
                markerIndex += 1;
              }
              if (hasShop) {
                const pulse = 0.9 + Math.sin(now / 220 + markerIndex * 0.55) * 0.1;
                const markerRadius = markerSize * pulse;
                context.beginPath();
                context.arc(cursorX, markerY, markerRadius, 0, Math.PI * 2);
                context.fillStyle = "#0ea5a4";
                context.fill();
                context.lineWidth = 1.4;
                context.strokeStyle = "rgba(15, 23, 42, 0.85)";
                context.stroke();
                context.save();
                context.globalAlpha = 0.24;
                context.beginPath();
                context.arc(cursorX, markerY, markerRadius + 3, 0, Math.PI * 2);
                context.fillStyle = "#2dd4bf";
                context.fill();
                context.restore();
                context.fillStyle = "rgba(248, 250, 252, 0.98)";
                drawRoundedRect(context, cursorX - 4.2, markerY - 1.6, 8.4, 5.8, 1.2);
                context.fill();
                context.strokeStyle = "rgba(15, 23, 42, 0.85)";
                context.lineWidth = 1.3;
                context.beginPath();
                context.arc(cursorX, markerY - 2.7, 2.5, Math.PI * 0.1, Math.PI * 0.9);
                context.stroke();
              }
            }

            drawRoundedRect(context, labelX, labelY, labelWidth, 13, 4);
            context.fillStyle = "rgba(2, 6, 23, 0.82)";
            context.fill();
            context.strokeStyle = "rgba(148, 163, 184, 0.45)";
            context.lineWidth = 1;
            context.stroke();
            context.fillStyle = "rgba(248, 250, 252, 0.96)";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(label, centerX, labelY + 6.5);
            context.restore();
          },
        });
        entityOrder += 1;
      }

      for (const enemy of enemiesRef.current) {
        if (!enemy.spawned) {
          continue;
        }

        const group = enemyGroupsRef.current.get(enemy.groupId);
        if (!group) {
          continue;
        }

        const sprite = enemyGroupFrameMap.get(enemy.groupId) ?? null;
        const spriteWidth = sprite && "width" in sprite && typeof sprite.width === "number" && sprite.width > 0 ? sprite.width : TILE_SIZE;
        const spriteHeight = sprite && "height" in sprite && typeof sprite.height === "number" && sprite.height > 0 ? sprite.height : TILE_SIZE;
        const baseUnit = TILE_SIZE / Math.max(spriteWidth, spriteHeight);
        const drawWidth = spriteWidth * baseUnit * group.spriteScale;
        const drawHeight = spriteHeight * baseUnit * group.spriteScale;
        const centerX = enemy.renderX * TILE_SIZE + TILE_SIZE / 2;
        const baseY = enemy.renderY * TILE_SIZE + TILE_SIZE;
        const movementProgress = enemy.moving ? clamp((now - enemy.moveStartedAt) / enemy.moveDurationMs, 0, 1) : 0;
        const wave = Math.sin(movementProgress * Math.PI);
        const bobY = enemy.moving ? Math.abs(wave) * 2.2 : 0;
        const shadowPulse = enemy.moving ? Math.abs(wave) * 0.05 : 0;
        const walkPhase = enemy.moving ? now / 86 + enemy.tileX * 0.43 + enemy.tileY * 0.27 : 0;
        const walkSwing = enemy.moving ? Math.sin(walkPhase) * 0.07 : 0;
        const walkStretch = enemy.moving ? Math.abs(Math.sin(walkPhase)) : 0;
        const walkScaleX = enemy.moving ? 1 + walkStretch * 0.035 : 1;
        const walkScaleY = enemy.moving ? 1 - walkStretch * 0.05 : 1;
        const walkStepX = enemy.moving ? Math.cos(walkPhase) * 0.7 : 0;
        const enemyAsset = enemySpriteMapRef.current.get(enemy.groupId) ?? null;
        const enemyBreath = getIdleBreath(now, enemy.tileX * 0.61 + enemy.tileY * 0.37, !enemy.moving && !enemyAsset?.frames);
        const finalEnemyScaleX = walkScaleX * enemyBreath.scaleX;
        const finalEnemyScaleY = walkScaleY * enemyBreath.scaleY;
        const baseFlip = group.flipHorizontal ? -1 : 1;
        const directionalFlip = enemy.facingX > 0 ? -1 : 1;
        const finalFlip = baseFlip * directionalFlip;
        const lungeProgress = enemy.attackLungeUntil > now ? 1 - (enemy.attackLungeUntil - now) / ATTACK_LUNGE_DURATION_MS : 0;
        const lungePingPong = lungeProgress < 0.5 ? lungeProgress * 2 : (1 - lungeProgress) * 2;
        const lungePhase = clamp(lungePingPong, 0, 1);
        const lungeEase = lungePhase * lungePhase * (3 - 2 * lungePhase);
        const lungeAmount = lungeProgress > 0 ? lungeEase * enemy.attackLungeDistance : 0;
        const lungeOffsetX = enemy.attackLungeDx * lungeAmount;
        const lungeOffsetY = enemy.attackLungeDy * lungeAmount;
        const enemyAttackShake = enemy.attackLungeUntil > now ? 1 - (enemy.attackLungeUntil - now) / ATTACK_LUNGE_DURATION_MS : 0;
        const enemyHitShake = enemy.hitFlashUntil > now ? clamp((enemy.hitFlashUntil - now) / 130, 0, 1) : 0;
        const enemyShakeStrength = clamp(Math.max(enemyAttackShake * 0.6, enemyHitShake * 0.45), 0, 1);
        const enemyShakeX = enemyShakeStrength > 0 ? Math.sin(now * 0.22 + enemy.tileX * 1.7) * 1.05 * enemyShakeStrength : 0;
        const enemyShakeY = enemyShakeStrength > 0 ? Math.cos(now * 0.27 + enemy.tileY * 1.3) * 0.5 * enemyShakeStrength : 0;
        const deathProgress = enemy.deathStartedAt > 0 ? clamp((now - enemy.deathStartedAt) / ENEMY_DEATH_DURATION_MS, 0, 1) : 0;
        const deathAlpha = 1 - deathProgress;
        const spawnProgress = enemy.spawnFxUntil > now ? 1 - (enemy.spawnFxUntil - now) / ENEMY_SPAWN_PORTAL_MS : 1;
        const spawnReveal = enemy.deathStartedAt === 0 ? clamp(spawnProgress, 0, 1) : 1;
        const spawnLift = enemy.deathStartedAt === 0 ? (1 - spawnReveal) * (drawHeight * 0.36 + 5) : 0;
        let deathSeed = 0;
        for (let index = 0; index < enemy.id.length; index += 1) {
          deathSeed = ((deathSeed << 5) - deathSeed + enemy.id.charCodeAt(index)) | 0;
        }
        const selected = selectedEnemyIdRef.current === enemy.id;
        const hpRatio = toHealthRatio(enemy.hp, enemy.maxHp);
        const healthWidth = clamp(drawWidth * 0.62, 30, 84);
        const healthX = centerX - healthWidth / 2;
        const healthY = baseY - drawHeight - 11;

        entities.push({
          depth: baseY,
          order: entityOrder,
          draw: () => {
            if (spawnProgress < 1 && enemy.deathStartedAt === 0) {
              drawEnemySpawnPortal(context, centerX, baseY + lungeOffsetY + enemyShakeY, drawWidth, spawnProgress, now);
            }

            const shadowFade = (0.3 + spawnReveal * 0.7) * clamp(1 - deathProgress * 0.65, 0.25, 1);
            drawSpriteShadow(
              context,
              sprite,
              centerX + lungeOffsetX + enemyShakeX,
              baseY + lungeOffsetY + enemyShakeY,
              drawWidth,
              drawHeight,
              finalFlip,
              (0.15 + shadowPulse + enemyBreath.shadowPulse) * shadowFade,
            );

            context.save();
            context.globalAlpha = deathAlpha;
            context.translate(
              centerX + lungeOffsetX + enemyShakeX + walkStepX,
              baseY - bobY - enemyBreath.bobY + lungeOffsetY + enemyShakeY + spawnLift - deathProgress * 8,
            );
            if (enemy.moving) {
              context.rotate(walkSwing);
            }
            context.scale(finalFlip * finalEnemyScaleX, finalEnemyScaleY);
            if (sprite) {
              if (deathProgress > 0) {
                drawSpriteDeathDissolve(context, sprite, spriteWidth, spriteHeight, drawWidth, drawHeight, deathProgress, deathSeed);
              } else if (spawnReveal < 0.995) {
                context.save();
                context.beginPath();
                context.rect(-drawWidth / 2, -drawHeight * spawnReveal, drawWidth, drawHeight * spawnReveal);
                context.clip();
                context.drawImage(sprite, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
                context.restore();

                const glow = clamp((1 - spawnReveal) * 0.95, 0, 0.95);
                if (glow > 0.01) {
                  context.globalCompositeOperation = "lighter";
                  context.globalAlpha = glow;
                  context.fillStyle = "rgba(45, 212, 191, 0.24)";
                  context.fillRect(-drawWidth * 0.45, -drawHeight * spawnReveal, drawWidth * 0.9, drawHeight * spawnReveal);
                  context.globalCompositeOperation = "source-over";
                  context.globalAlpha = deathAlpha;
                }
              } else {
                context.drawImage(sprite, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
              }

              if (enemy.hitFlashUntil > now && deathProgress <= 0) {
                const flash = clamp((enemy.hitFlashUntil - now) / 130, 0, 1);
                context.globalAlpha = flash * 0.7;
                context.filter = "sepia(1) saturate(8) hue-rotate(-35deg) brightness(0.95)";
                context.drawImage(sprite, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
                context.filter = "none";
              }

              if (selected && enemy.deathStartedAt === 0) {
                const radius = Math.max(drawWidth, drawHeight) * 0.5 + 6;
                context.strokeStyle = "rgba(239, 68, 68, 0.98)";
                context.lineWidth = 2.3;
                context.setLineDash([9, 6]);
                context.lineDashOffset = -(now / 30);
                context.beginPath();
                context.arc(0, -drawHeight * 0.52, radius, 0, Math.PI * 2);
                context.stroke();
                context.setLineDash([]);
                context.lineDashOffset = 0;
              }
            } else {
              context.fillStyle = "rgba(203, 213, 225, 0.85)";
              context.fillRect(-6, -18, 12, 16);
            }
            context.restore();

            context.save();
            context.globalAlpha = 0.9 * deathAlpha;
            context.fillStyle = "rgba(15, 23, 42, 0.72)";
            context.fillRect(healthX, healthY, healthWidth, 4);
            context.fillStyle = hpRatio > 0.45 ? "rgba(52, 211, 153, 0.95)" : hpRatio > 0.2 ? "rgba(251, 191, 36, 0.95)" : "rgba(248, 113, 113, 0.95)";
            context.fillRect(healthX, healthY, healthWidth * hpRatio, 4);
            if (selected) {
              context.strokeStyle = "rgba(239, 68, 68, 0.95)";
              context.lineWidth = 1;
              context.strokeRect(healthX - 0.5, healthY - 0.5, healthWidth + 1, 5);
            }
            context.restore();
          },
        });
        entityOrder += 1;
      }

      const playerSpriteWidth =
        playerSprite && "width" in playerSprite && typeof playerSprite.width === "number" && playerSprite.width > 0
          ? playerSprite.width
          : TILE_SIZE;
      const playerSpriteHeight =
        playerSprite && "height" in playerSprite && typeof playerSprite.height === "number" && playerSprite.height > 0
          ? playerSprite.height
          : TILE_SIZE;
      const spriteBaseUnit = TILE_SIZE / Math.max(playerSpriteWidth, playerSpriteHeight);
      const spriteBaseWidth = playerSpriteWidth * spriteBaseUnit * playerRef.current.scaleX;
      const spriteBaseHeight = playerSpriteHeight * spriteBaseUnit * playerRef.current.scaleY;
      const playerCenterX = playerRef.current.renderX * TILE_SIZE + TILE_SIZE / 2;
      const playerBaseY = playerRef.current.renderY * TILE_SIZE + TILE_SIZE;
      const moveWave = Math.sin(moveT * Math.PI);
      const playerBobY = playerRef.current.moving ? Math.abs(moveWave) * 2.2 : 0;
      const playerShadowPulse = playerRef.current.moving ? Math.abs(moveWave) * 0.05 : 0;
      const playerWalkPhase = playerRef.current.moving ? now / 86 + playerRef.current.tileX * 0.41 + playerRef.current.tileY * 0.33 : 0;
      const playerWalkSwing = playerRef.current.moving ? Math.sin(playerWalkPhase) * 0.06 : 0;
      const playerWalkStretch = playerRef.current.moving ? Math.abs(Math.sin(playerWalkPhase)) : 0;
      const playerWalkScaleX = playerRef.current.moving ? 1 + playerWalkStretch * 0.032 : 1;
      const playerWalkScaleY = playerRef.current.moving ? 1 - playerWalkStretch * 0.048 : 1;
      const playerWalkStepX = playerRef.current.moving ? Math.cos(playerWalkPhase) * 0.66 : 0;
      const playerBreath = getIdleBreath(now, playerRef.current.tileX * 0.47 + playerRef.current.tileY * 0.29, !playerRef.current.moving && !spriteFramesRef.current);
      const finalPlayerScaleX = playerWalkScaleX * playerBreath.scaleX;
      const finalPlayerScaleY = playerWalkScaleY * playerBreath.scaleY;
      const playerLungeProgress = playerRef.current.attackLungeUntil > now ? 1 - (playerRef.current.attackLungeUntil - now) / ATTACK_LUNGE_DURATION_MS : 0;
      const playerLungePingPong = playerLungeProgress < 0.5 ? playerLungeProgress * 2 : (1 - playerLungeProgress) * 2;
      const playerLungePhase = clamp(playerLungePingPong, 0, 1);
      const playerLungeEase = playerLungePhase * playerLungePhase * (3 - 2 * playerLungePhase);
      const playerLungeAmount = playerLungeProgress > 0 ? playerLungeEase * playerRef.current.attackLungeDistance : 0;
      const playerLungeOffsetX = playerRef.current.attackLungeDx * playerLungeAmount;
      const playerLungeOffsetY = playerRef.current.attackLungeDy * playerLungeAmount;
      const playerAttackShake = playerRef.current.attackLungeUntil > now ? 1 - (playerRef.current.attackLungeUntil - now) / ATTACK_LUNGE_DURATION_MS : 0;
      const playerHitShake = playerRef.current.hitFlashUntil > now ? clamp((playerRef.current.hitFlashUntil - now) / 130, 0, 1) : 0;
      const playerShakeStrength = clamp(Math.max(playerAttackShake * 0.6, playerHitShake * 0.45), 0, 1);
      const playerShakeX = playerShakeStrength > 0 ? Math.sin(now * 0.23 + 0.4) * 1.1 * playerShakeStrength : 0;
      const playerShakeY = playerShakeStrength > 0 ? Math.cos(now * 0.29 + 0.7) * 0.52 * playerShakeStrength : 0;
      const playerHpRatio = toHealthRatio(playerRef.current.hp, playerRef.current.maxHp);
      const playerXpRatio = toHealthRatio(playerRef.current.experience, playerRef.current.experienceMax);
      const playerHealthWidth = clamp(spriteBaseWidth * 0.6, 36, 92);
      const playerPanelWidth = clamp(Math.max(playerHealthWidth + 30, 136), 136, 190);
      const playerPanelHeight = 40;
      const playerPanelPaddingX = 10;
      const playerPanelPaddingTop = 6;
      const playerPanelX = playerCenterX - playerPanelWidth / 2;
      const playerPanelY = playerBaseY - spriteBaseHeight - 44;
      const playerBarWidth = playerPanelWidth - playerPanelPaddingX * 2;
      const playerHealthX = playerPanelX + playerPanelPaddingX;
      const playerHealthY = playerPanelY + playerPanelPaddingTop + 9;
      const playerXpY = playerHealthY + 8;
      const playerLabel = `${playerRef.current.animaName} (Lv.${playerRef.current.level})`;

      entities.push({
        depth: playerBaseY,
        order: entityOrder,
        draw: () => {
          drawSpriteShadow(
            context,
            playerSprite,
            playerCenterX + playerLungeOffsetX + playerShakeX,
            playerBaseY + playerLungeOffsetY + playerShakeY,
            spriteBaseWidth,
            spriteBaseHeight,
            playerRef.current.facingX * spriteBaseFlipRef.current,
            0.17 + playerShadowPulse + playerBreath.shadowPulse,
          );

          context.save();
          context.translate(
            playerCenterX + playerLungeOffsetX + playerShakeX + playerWalkStepX,
            playerBaseY - playerBobY - playerBreath.bobY + playerLungeOffsetY + playerShakeY,
          );
          if (playerRef.current.moving) {
            context.rotate(playerWalkSwing);
          }
          context.scale(playerRef.current.facingX * spriteBaseFlipRef.current * finalPlayerScaleX, finalPlayerScaleY);
          if (playerSprite) {
            context.drawImage(playerSprite, -spriteBaseWidth / 2, -spriteBaseHeight, spriteBaseWidth, spriteBaseHeight);
            if (playerRef.current.hitFlashUntil > now) {
              const flash = clamp((playerRef.current.hitFlashUntil - now) / 130, 0, 1);
              context.globalAlpha = flash * 0.68;
              context.filter = "sepia(1) saturate(8) hue-rotate(-35deg) brightness(0.95)";
              context.drawImage(playerSprite, -spriteBaseWidth / 2, -spriteBaseHeight, spriteBaseWidth, spriteBaseHeight);
              context.filter = "none";
            }
          } else {
            context.fillStyle = "#ffffff";
            context.beginPath();
            context.arc(0, -spriteBaseHeight / 2, 10, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();

          const levelAura = levelUpAuraRef.current;
          if (levelAura) {
            const auraT = clamp((now - levelAura.startedAt) / levelAura.ttlMs, 0, 1);
            if (auraT < 1) {
              const auraAlpha = (1 - auraT) * 0.65;
              const auraRadius = Math.max(spriteBaseWidth, spriteBaseHeight) * (0.42 + auraT * 0.88);
              context.save();
              context.globalCompositeOperation = "lighter";
              context.globalAlpha = auraAlpha;
              const auraGradient = context.createRadialGradient(playerCenterX, playerBaseY - spriteBaseHeight * 0.56, auraRadius * 0.2, playerCenterX, playerBaseY - spriteBaseHeight * 0.56, auraRadius);
              auraGradient.addColorStop(0, "rgba(134, 239, 172, 0.7)");
              auraGradient.addColorStop(0.55, "rgba(74, 222, 128, 0.35)");
              auraGradient.addColorStop(1, "rgba(16, 185, 129, 0)");
              context.fillStyle = auraGradient;
              context.beginPath();
              context.arc(playerCenterX, playerBaseY - spriteBaseHeight * 0.56, auraRadius, 0, Math.PI * 2);
              context.fill();
              context.strokeStyle = `rgba(167, 243, 208, ${0.88 * auraAlpha})`;
              context.lineWidth = 2.4;
              context.beginPath();
              context.arc(playerCenterX, playerBaseY - spriteBaseHeight * 0.56, auraRadius * 0.82, 0, Math.PI * 2);
              context.stroke();

              const arrowBaseX = playerCenterX;
              const arrowBaseY = playerBaseY - spriteBaseHeight * 0.52;
              const arrowCount = 5;
              for (let index = 0; index < arrowCount; index += 1) {
                const phase = (auraT * 1.8 + index * 0.17) % 1;
                const rise = phase * 22;
                const spread = (index - (arrowCount - 1) / 2) * 9;
                const alphaArrow = (1 - phase) * auraAlpha * 0.9;
                const x = arrowBaseX + spread;
                const y = arrowBaseY - rise;
                context.strokeStyle = `rgba(167, 243, 208, ${alphaArrow})`;
                context.lineWidth = 1.6;
                context.beginPath();
                context.moveTo(x - 3.4, y + 2.2);
                context.lineTo(x, y - 2.4);
                context.lineTo(x + 3.4, y + 2.2);
                context.stroke();
              }
              context.restore();
            } else {
              levelUpAuraRef.current = null;
            }
          }

          context.save();
          drawRoundedRect(context, playerPanelX, playerPanelY, playerPanelWidth, playerPanelHeight, 9);
          context.fillStyle = "rgba(2, 6, 23, 0.76)";
          context.fill();
          context.strokeStyle = "rgba(148, 163, 184, 0.34)";
          context.lineWidth = 1;
          context.stroke();

          context.font = "600 10px Geist, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillStyle = "rgba(248, 250, 252, 0.97)";
          context.fillText(playerLabel, playerCenterX, playerPanelY + playerPanelPaddingTop + 3);

          drawRoundedRect(context, playerHealthX, playerHealthY, playerBarWidth, 5.2, 3);
          context.fillStyle = "rgba(15, 23, 42, 0.9)";
          context.fill();
          drawRoundedRect(context, playerHealthX, playerHealthY, playerBarWidth * playerHpRatio, 5.2, 3);
          context.fillStyle =
            playerHpRatio > 0.45 ? "rgba(74, 222, 128, 0.96)" : playerHpRatio > 0.2 ? "rgba(250, 204, 21, 0.96)" : "rgba(248, 113, 113, 0.96)";
          context.fill();
          drawRoundedRect(context, playerHealthX - 0.5, playerHealthY - 0.5, playerBarWidth + 1, 6.2, 3);
          context.strokeStyle = "rgba(226, 232, 240, 0.52)";
          context.stroke();

          drawRoundedRect(context, playerHealthX, playerXpY, playerBarWidth, 4.4, 2.7);
          context.fillStyle = "rgba(15, 23, 42, 0.9)";
          context.fill();
          drawRoundedRect(context, playerHealthX, playerXpY, playerBarWidth * playerXpRatio, 4.4, 2.7);
          context.fillStyle = "rgba(96, 165, 250, 0.98)";
          context.fill();
          drawRoundedRect(context, playerHealthX - 0.5, playerXpY - 0.5, playerBarWidth + 1, 5.4, 2.7);
          context.strokeStyle = "rgba(191, 219, 254, 0.52)";
          context.stroke();
          context.restore();
        },
      });

      entities
        .sort((left, right) => (left.depth === right.depth ? left.order - right.order : left.depth - right.depth))
        .forEach((entity) => entity.draw());

      attackEffectsRef.current = attackEffectsRef.current.filter((effect) => now - effect.createdAt < effect.ttlMs);
      for (const effect of attackEffectsRef.current) {
        const t = clamp((now - effect.createdAt) / effect.ttlMs, 0, 1);
        const eased = t * t * (3 - 2 * t);
        const headProgress = clamp(0.2 + eased * 0.82, 0, 1);
        const tailProgress = clamp(headProgress - 0.34, 0, 1);
        const headX = effect.fromX + (effect.toX - effect.fromX) * headProgress;
        const headY = effect.fromY + (effect.toY - effect.fromY) * headProgress;
        const tailX = effect.fromX + (effect.toX - effect.fromX) * tailProgress;
        const tailY = effect.fromY + (effect.toY - effect.fromY) * tailProgress;
        const alpha = 1 - t;
        const primaryColor = effect.fromEnemy ? "rgba(251, 146, 60, 1)" : "rgba(248, 113, 113, 1)";
        const secondaryColor = effect.fromEnemy ? "rgba(253, 186, 116, 1)" : "rgba(252, 165, 165, 1)";
        const accentColor = effect.critical ? "rgba(253, 224, 71, 1)" : secondaryColor;
        const angle = Math.atan2(effect.toY - effect.fromY, effect.toX - effect.fromX);
        const slashLen = effect.critical ? 17 : 13;
        const shockRadius = (effect.critical ? 13.5 : 9.2) * (0.75 + (1 - Math.abs(0.5 - t) * 2) * 0.5);
        const sparkCount = effect.critical ? 8 : 5;

        context.save();
        const beamGradient = context.createLinearGradient(tailX, tailY, headX, headY);
        beamGradient.addColorStop(0, `rgba(148, 163, 184, ${0.02 * alpha})`);
        beamGradient.addColorStop(0.2, effect.fromEnemy ? `rgba(253, 186, 116, ${0.26 * alpha})` : `rgba(252, 165, 165, ${0.28 * alpha})`);
        beamGradient.addColorStop(0.8, effect.critical ? `rgba(253, 224, 71, ${0.7 * alpha})` : `rgba(248, 250, 252, ${0.52 * alpha})`);
        beamGradient.addColorStop(1, effect.fromEnemy ? `rgba(251, 146, 60, ${0.8 * alpha})` : `rgba(248, 113, 113, ${0.82 * alpha})`);
        context.strokeStyle = beamGradient;
        context.lineWidth = effect.critical ? 4.8 : 3.6;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(headX, headY);
        context.stroke();

        context.strokeStyle = effect.fromEnemy ? `rgba(255, 237, 213, ${0.68 * alpha})` : `rgba(254, 226, 226, ${0.7 * alpha})`;
        context.lineWidth = effect.critical ? 1.8 : 1.3;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(headX, headY);
        context.stroke();

        context.translate(headX, headY);
        context.rotate(angle + Math.PI * 0.5);
        context.strokeStyle = effect.critical ? `rgba(253, 224, 71, ${0.95 * alpha})` : `rgba(248, 250, 252, ${0.72 * alpha})`;
        context.lineWidth = effect.critical ? 3.2 : 2.2;
        context.setLineDash(effect.critical ? [10, 5] : [8, 5]);
        context.lineDashOffset = -(now / 18);
        context.beginPath();
        context.moveTo(-slashLen, -slashLen * 0.18);
        context.lineTo(slashLen, slashLen * 0.18);
        context.stroke();
        context.setLineDash([]);
        context.strokeStyle = effect.critical ? `rgba(254, 240, 138, ${alpha})` : `rgba(226, 232, 240, ${0.64 * alpha})`;
        context.lineWidth = effect.critical ? 2.6 : 1.8;
        context.rotate(Math.PI / 2);
        context.beginPath();
        context.moveTo(-slashLen * 0.62, 0);
        context.lineTo(slashLen * 0.62, 0);
        context.stroke();

        context.strokeStyle = effect.fromEnemy ? `rgba(253, 186, 116, ${0.55 * alpha})` : `rgba(254, 202, 202, ${0.6 * alpha})`;
        context.lineWidth = effect.critical ? 2.1 : 1.5;
        context.beginPath();
        context.arc(0, 0, shockRadius, 0, Math.PI * 2);
        context.stroke();

        context.fillStyle = effect.critical ? `rgba(253, 224, 71, ${0.5 * alpha})` : `rgba(248, 250, 252, ${0.36 * alpha})`;
        context.beginPath();
        context.arc(0, 0, shockRadius * 0.45, 0, Math.PI * 2);
        context.fill();

        for (let sparkIndex = 0; sparkIndex < sparkCount; sparkIndex += 1) {
          const sparkAngle = (Math.PI * 2 * sparkIndex) / sparkCount + now * 0.004 + (effect.critical ? 0.2 : 0);
          const sparkTravel = shockRadius * (0.75 + sparkIndex * 0.09);
          const sparkX = Math.cos(sparkAngle) * sparkTravel;
          const sparkY = Math.sin(sparkAngle) * sparkTravel;
          context.strokeStyle = sparkIndex % 2 === 0 ? accentColor.replace(", 1)", `, ${0.92 * alpha})`) : primaryColor.replace(", 1)", `, ${0.74 * alpha})`);
          context.lineWidth = effect.critical ? 1.9 : 1.4;
          context.beginPath();
          context.moveTo(sparkX * 0.34, sparkY * 0.34);
          context.lineTo(sparkX, sparkY);
          context.stroke();
        }
        context.restore();
      }

      impactRingsRef.current = impactRingsRef.current.filter((ring) => now - ring.createdAt < ring.ttlMs);
      for (const ring of impactRingsRef.current) {
        const t = clamp((now - ring.createdAt) / ring.ttlMs, 0, 1);
        const alpha = (1 - t) * (ring.critical ? 0.95 : 0.8);
        const radius = (ring.critical ? 9 : 7) + t * (ring.critical ? 34 : 26);
        context.save();
        context.globalAlpha = alpha;
        context.globalCompositeOperation = "lighter";
        context.translate(ring.x, ring.y);
        context.strokeStyle = ring.color.replace(", 1)", `, ${0.85 * alpha})`);
        context.lineWidth = ring.critical ? 3.2 : 2.4;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "rgba(248, 250, 252, 0.75)";
        context.lineWidth = ring.critical ? 1.4 : 1.1;
        context.beginPath();
        context.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      impactParticlesRef.current = impactParticlesRef.current.filter((particle) => now - particle.createdAt < particle.ttlMs);
      for (const particle of impactParticlesRef.current) {
        const ageMs = now - particle.createdAt;
        const t = clamp(ageMs / particle.ttlMs, 0, 1);
        const dt = ageMs / 1000;
        const alpha = (1 - t) * (particle.glow ? 0.95 : 0.75);
        const px = particle.x + particle.vx * dt;
        const py = particle.y + particle.vy * dt + 0.5 * particle.gravity * dt * dt;
        const tailX = px - particle.vx * 0.018;
        const tailY = py - particle.vy * 0.018;

        context.save();
        context.globalAlpha = alpha;
        context.globalCompositeOperation = particle.glow ? "lighter" : "source-over";
        context.strokeStyle = particle.color.replace(", 1)", `, ${0.92 * alpha})`);
        context.lineWidth = particle.size;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(px, py);
        context.stroke();

        if (particle.glow) {
          context.globalAlpha = alpha * 0.35;
          context.strokeStyle = "rgba(248, 250, 252, 1)".replace(", 1)", `, ${0.55 * alpha})`);
          context.lineWidth = Math.max(1.2, particle.size * 1.9);
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(px, py);
          context.stroke();
        }
        context.restore();
      }

      damageTextsRef.current = damageTextsRef.current.filter((text) => now - text.createdAt < text.ttlMs);
      for (const text of damageTextsRef.current) {
        const t = clamp((now - text.createdAt) / text.ttlMs, 0, 1);
        const yOffset = 10 + t * 32;
        const alpha = 1 - t;
        const scale = 1 + (1 - t) * 0.28;
        const content = `-${text.value}`;
        context.save();
        context.globalAlpha = alpha;
        context.translate(text.x, text.y - yOffset);
        context.scale(scale, scale);
        context.font = text.critical ? "800 19px Geist, sans-serif" : "700 16px Geist, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const textColor = text.fromEnemy ? "rgba(252, 165, 165, 1)" : text.critical ? "rgba(253, 224, 71, 1)" : "rgba(248, 250, 252, 1)";
        context.fillStyle = textColor;
        context.strokeStyle = "rgba(2, 6, 23, 0.92)";
        context.lineWidth = 4.6;
        context.strokeText(content, 0, 0.5);
        context.fillText(content, 0, 0.5);
        context.restore();
      }

      rewardTextsRef.current = rewardTextsRef.current.filter((text) => now - text.createdAt < text.ttlMs);
      for (const text of rewardTextsRef.current) {
        const t = clamp((now - text.createdAt) / text.ttlMs, 0, 1);
        const yOffset = 4 + t * 18;
        const alpha = (1 - t) * 0.78;
        const scale = text.scale + (1 - t) * 0.04;
        context.save();
        context.globalAlpha = alpha;
        context.translate(text.x, text.y - yOffset);
        context.scale(scale, scale);
        context.font = "600 11px Geist, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = text.color;
        context.strokeStyle = "rgba(2, 6, 23, 0.5)";
        context.lineWidth = 1.6;
        context.strokeText(text.text, 0, 0.5);
        context.fillText(text.text, 0, 0.5);
        context.restore();
      }

      context.restore();

      const flash = screenFlashRef.current;
      if (flash) {
        const t = clamp((now - flash.startedAt) / flash.ttlMs, 0, 1);
        const alpha = flash.intensity * (1 - t);
        if (alpha > 0.001) {
          context.save();
          context.globalAlpha = alpha;
          context.fillStyle = flash.color.replace(", 1)", `, ${alpha})`);
          context.fillRect(0, 0, width, height);
          context.restore();
        }
        if (t >= 1) {
          screenFlashRef.current = null;
        }
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [activeMapNpcs, buildNavigationCollisionLayer, cancelTracking, isQuestDialogAvailable, isWalkableForPlayer, mapData, persistState, pushAttackEffect, pushDamageText, setCanvasCursorMode, spawnGroundDropsForEnemy, tryStartMove, turnInQuestTypesByNpc]);

  const npcOverlayTarget = npcConversationState?.npc ?? npcInteractionState?.npc ?? null;
  const npcOverlayPosition = useMemo(() => {
    if (!npcOverlayTarget) {
      return null;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const height = Math.max(8, npcOverlayTarget.height ?? 96);
    const centerX = npcOverlayTarget.tileX * TILE_SIZE + TILE_SIZE / 2;
    const baseY = npcOverlayTarget.tileY * TILE_SIZE + TILE_SIZE;
    const worldX = centerX;
    const worldY = baseY - height - 14;
    const screenX = worldX - cameraRef.current.x;
    const screenY = worldY - cameraRef.current.y;
    const clampedX = clamp(screenX, 16, Math.max(16, canvas.clientWidth - 16));
    const clampedY = clamp(screenY, 12, Math.max(12, canvas.clientHeight - 12));
    return {
      left: clampedX,
      top: clampedY,
    };
  }, [npcOverlayTarget]);

  const interactionQuestEntries = useMemo(() => {
    const npc = npcInteractionState?.npc;
    if (!npc) {
      return [] as NpcInteractionQuestEntry[];
    }
    const dialogs = npc.npc?.dialogs ?? [];
    const entries: NpcInteractionQuestEntry[] = [];
    for (const dialog of dialogs) {
      if (dialog.actionType !== "QUEST" || !dialog.quest) {
        continue;
      }
        const questType = normalizeQuestType(dialog.quest?.questType);
        const questKey = `${npc.npcId}:${dialog.id}`;
        const turnInQuest = turnInQuestByKey.get(questKey) ?? null;
        if (turnInQuest) {
          entries.push({
            dialog,
            questType,
            mode: "deliver",
            questId: turnInQuest.id,
            title: turnInQuest.title,
          });
          continue;
        }
        if (!isQuestDialogAvailable(npc.npcId, dialog)) {
          continue;
        }
        entries.push({
          dialog,
          questType,
          mode: "accept",
          questId: null,
          title: dialog.quest?.title || "Quest",
        });
      }
    return entries;
  }, [isQuestDialogAvailable, npcInteractionState, turnInQuestByKey]);

  const interactionShopBuyDialogs = useMemo(() => {
    const dialogs = npcInteractionState?.npc.npc?.dialogs ?? [];
    return dialogs.filter((dialog) => dialog.actionType === "SHOP_BUY");
  }, [npcInteractionState]);

  const interactionShopCraftDialogs = useMemo(() => {
    const dialogs = npcInteractionState?.npc.npc?.dialogs ?? [];
    return dialogs.filter((dialog) => dialog.actionType === "SHOP_CRAFT");
  }, [npcInteractionState]);


  return (
    <section className={focusMode ? "h-screen w-full overflow-hidden bg-black" : "space-y-4"}>
      {focusMode ? null : (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Compass className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wide">Explorar</p>
          <Badge variant="secondary">{mapData?.name ?? "Mapa ativo"}</Badge>
        </div>
      )}

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Carregando mapa...</p> : null}

      <div
        className="relative select-none"
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <canvas
          ref={canvasRef}
          className={
            focusMode
              ? "h-screen min-h-screen w-full border-0 bg-black select-none"
              : "h-[74vh] min-h-[520px] w-full rounded-md border bg-black/30 select-none"
          }
          onContextMenu={(event) => {
            event.preventDefault();
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const world = pointerToWorld(event);
            const tile = pointerToTile(event);
            if (world) {
              const drop = findDropAtWorldPoint(world.x, world.y);
              if (drop) {
                mouseHeldRef.current = false;
                routeRef.current = [];
                routeAllowsCornerCutRef.current = false;
                selectedEnemyIdRef.current = null;
                playerRef.current.trackingEnemyId = null;
                playerRef.current.nextTrackingPathAt = 0;
                collectingDropIdRef.current = drop.id;
                recalculatePath({ x: drop.tileX, y: drop.tileY });
                return;
              }

              const npc = findNpcAtWorldPoint(world.x, world.y);
              if (npc) {
                mouseHeldRef.current = false;
                routeRef.current = [];
                routeAllowsCornerCutRef.current = false;
                collectingDropIdRef.current = null;
                cancelTracking();
                if (planNpcApproach(npc)) {
                  return;
                }
                const dialogs = npc.npc?.dialogs ?? [];
                if (dialogs.length > 0) {
                  setNpcConversationState(null);
                  setNpcInteractionState({ npc });
                  void registerNpcTalk(npc.npcId)
                    .then((result) => {
                      setActiveQuests(result.activeQuests);
                    })
                    .catch((error) => {
                      if (error instanceof ApiError) {
                        setErrorMessage(error.message);
                      } else {
                        setErrorMessage("Falha ao registrar conversa com NPC.");
                      }
                    });
                }
                return;
              }

              const enemy = findEnemyAtWorldPoint(world.x, world.y) ?? (tile ? findEnemyAtTile(tile) : null);
              if (enemy) {
                mouseHeldRef.current = false;
                routeRef.current = [];
                routeAllowsCornerCutRef.current = false;
                collectingDropIdRef.current = null;
                selectedEnemyIdRef.current = enemy.id;
                playerRef.current.trackingEnemyId = enemy.id;
                playerRef.current.nextTrackingPathAt = 0;
                engagedEnemyIdRef.current = enemy.id;
                for (const runtimeEnemy of enemiesRef.current) {
                  if (runtimeEnemy.id !== enemy.id) {
                    runtimeEnemy.aggroUntilAt = 0;
                    runtimeEnemy.route = [];
                  }
                }
                enemy.aggroUntilAt = performance.now() + ENEMY_AGGRO_DURATION_MS;
                return;
              }
            }

            setNpcInteractionState(null);
            setNpcConversationState(null);
            cancelTracking();
            if (portalPromptRef.current && !teleportingRef.current) {
              suppressPortalPromptUntilLeaveRef.current = true;
              setPortalPrompt(null);
            }
            collectingDropIdRef.current = null;
            mouseHeldRef.current = true;
            hoverTargetRef.current = tile;
            recalculatePath(tile);
          }}
          onPointerMove={(event) => {
            const world = pointerToWorld(event);
            if (world && findDropAtWorldPoint(world.x, world.y)) {
              setCanvasCursorMode("copy");
            } else {
              setCanvasCursorMode("default");
            }

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
            setCanvasCursorMode("default");
          }}
        />
        {evolutionVfx?.active ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <div
              className={cn(
                "absolute inset-0 animate-pulse",
                evolutionVfx.tone === "evolved"
                  ? "bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.26)_0%,rgba(34,211,238,0.09)_40%,rgba(2,6,23,0.65)_100%)]"
                  : "bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.26)_0%,rgba(251,191,36,0.09)_40%,rgba(2,6,23,0.65)_100%)]",
              )}
            />
            <div className="absolute h-52 w-52 rounded-full border border-white/20 animate-ping" />
            <div className={cn("absolute h-72 w-72 rounded-full border animate-pulse", evolutionVfx.tone === "evolved" ? "border-cyan-300/30" : "border-amber-300/30")} />
          </div>
        ) : null}
        <FloatingBagMenu embedded focusMode={focusMode} onToggleFocusMode={() => setFocusMode((current) => !current)} />
        {npcInteractionState && npcOverlayPosition ? (
          <div
            className="pointer-events-auto absolute z-30 w-[min(92vw,340px)] -translate-x-1/2 -translate-y-full"
            style={{ left: npcOverlayPosition.left, top: npcOverlayPosition.top }}
          >
            <div className="rounded-2xl border border-slate-200/20 bg-slate-950/88 p-3 shadow-[0_22px_48px_-22px_rgba(0,0,0,0.75)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-100">{npcInteractionState.npc.npc?.name ?? npcInteractionState.npc.npcName ?? "NPC"}</p>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-300 hover:text-slate-100" onClick={() => setNpcInteractionState(null)}>
                  Fechar
                </Button>
              </div>
              <div className="space-y-2">
                {interactionQuestEntries.map((entry) => {
                  const visual = questTypeVisualMap[entry.questType];
                  const symbol = entry.mode === "deliver" ? "?" : "!";
                  return (
                    <Button
                      key={`quest_${entry.dialog.id}_${entry.mode}`}
                      size="sm"
                      variant="outline"
                      className="w-full justify-between gap-2 bg-slate-900/28 text-slate-100 backdrop-blur-sm hover:bg-slate-900/45"
                      style={{ borderColor: `${visual.color}66` }}
                      onClick={() => openNpcConversation(npcInteractionState.npc, [entry.dialog], { mode: entry.mode, questId: entry.questId })}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                          style={{ backgroundColor: visual.color }}
                        >
                          {symbol}
                        </span>
                        <span className="truncate text-left">{entry.title}</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: visual.textColor }}>
                        {entry.mode === "deliver" ? "Entregar" : visual.label}
                      </span>
                    </Button>
                  );
                })}

                {interactionShopBuyDialogs.map((dialog, index) => (
                  <Button
                    key={`shop_buy_${dialog.id}`}
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      if (planNpcApproach(npcInteractionState.npc)) {
                        return;
                      }
                      setNpcInteractionState(null);
                      setNpcShopState({
                        npcId: npcInteractionState.npc.npcId,
                        dialogId: dialog.id,
                        dialog,
                      });
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Lojinha {interactionShopBuyDialogs.length > 1 ? `#${index + 1}` : ""}
                  </Button>
                ))}

                {interactionShopCraftDialogs.map((dialog, index) => (
                  <Button
                    key={`shop_craft_${dialog.id}`}
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      if (planNpcApproach(npcInteractionState.npc)) {
                        return;
                      }
                      setNpcInteractionState(null);
                      setNpcShopState({
                        npcId: npcInteractionState.npc.npcId,
                        dialogId: dialog.id,
                        dialog,
                      });
                    }}
                  >
                    <Wrench className="h-4 w-4" />
                    Craft {interactionShopCraftDialogs.length > 1 ? `#${index + 1}` : ""}
                  </Button>
                ))}

                {interactionQuestEntries.length === 0 &&
                interactionShopBuyDialogs.length === 0 &&
                interactionShopCraftDialogs.length === 0 ? (
                  <p className="text-xs text-slate-400">Este NPC nao possui interacoes configuradas.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {npcConversationState && npcOverlayPosition ? (
          <div
            className="pointer-events-auto absolute z-30 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-full"
            style={{ left: npcOverlayPosition.left, top: npcOverlayPosition.top }}
          >
            <div className="rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 p-3 shadow-[0_26px_52px_-22px_rgba(0,0,0,0.82)] backdrop-blur-xl">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">{npcConversationState.npc.npc?.name ?? npcConversationState.npc.npcName ?? "NPC"}</p>
              <p className="text-sm leading-relaxed text-slate-100">
                {npcConversationState.dialogs[npcConversationState.index]?.text ?? "Dialogo sem conteudo."}
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:text-slate-100"
                  disabled={npcConversationSubmitting}
                  onClick={() => setNpcConversationState(null)}
                >
                  Fechar
                </Button>
                <Button size="sm" disabled={npcConversationSubmitting} onClick={() => void handleAdvanceNpcConversation()}>
                  {(() => {
                    const current = npcConversationState.dialogs[npcConversationState.index];
                    const isLast = npcConversationState.index >= npcConversationState.dialogs.length - 1;
                    if (!isLast) return "Proximo";
                    if (!current) return "Concluir";
                    if (current.actionType === "QUEST") {
                      if (npcConversationSubmitting) {
                        return npcConversationState.questAction.mode === "deliver" ? "Entregando..." : "Aceitando...";
                      }
                      return npcConversationState.questAction.mode === "deliver" ? "Entregar Quest" : "Aceitar Quest";
                    }
                    if (current.actionType === "SHOP_BUY") return "Abrir Lojinha";
                    if (current.actionType === "SHOP_CRAFT") return "Abrir Craft";
                    return "Concluir";
                  })()}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="pointer-events-none absolute right-4 top-4 z-20 w-[min(360px,42vw)]"
          style={{ transform: `translate(${questHudOffset.x}px, ${questHudOffset.y}px)` }}
        >
          <div className="pointer-events-auto max-h-[42vh] overflow-y-auto rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/94 via-slate-900/92 to-slate-950/94 p-2.5 shadow-[0_22px_48px_-22px_rgba(0,0,0,0.78)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 ${
                  questHudDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                onPointerDown={startQuestHudDrag}
              >
                <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                Quests
              </button>
              <Badge className="border-slate-300/20 bg-slate-800/70 text-slate-200 hover:bg-slate-800/70">{activeQuests.length}/3</Badge>
            </div>
              {questLoading ? <p className="px-1 text-[11px] text-slate-400">Atualizando...</p> : null}
              {activeQuests.length === 0 ? <p className="px-1 text-[11px] text-slate-400">Nenhuma quest ativa.</p> : null}
              <div className="space-y-1.5">
                {activeQuests.map((quest) => {
                  const totalObjectives = Math.max(1, quest.objectives.length);
                  const completedObjectives = quest.objectives.filter((objective) => objective.completed).length;
                  return (
                    <button
                      key={quest.id}
                      type="button"
                      className="w-full rounded-lg border border-slate-300/15 bg-slate-900/40 px-2 py-2 text-left transition hover:bg-slate-900/62"
                      onClick={() => setQuestDetail(quest)}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-slate-100">{quest.title}</p>
                        <span className={`text-[10px] font-semibold ${quest.turnInReady ? "text-emerald-300" : "text-slate-400"}`}>
                          {quest.turnInReady ? "Pronta" : `${completedObjectives}/${totalObjectives}`}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {quest.objectives.map((objective) => (
                          <p key={objective.id} className={`text-[11px] leading-snug ${objective.completed ? "text-emerald-200" : "text-slate-300"}`}>
                            {getQuestObjectiveLabel(objective)} {objective.current}/{objective.required}
                          </p>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(portalPrompt)}
        onOpenChange={(open) => {
          if (!open && !teleporting) {
            suppressPortalPromptUntilLeaveRef.current = true;
            setPortalPrompt(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atravessar portal</DialogTitle>
            <DialogDescription>Deseja ir para o proximo mapa?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={teleporting}
              onClick={() => {
                suppressPortalPromptUntilLeaveRef.current = true;
                setPortalPrompt(null);
              }}
            >
              Nao
            </Button>
            <Button disabled={teleporting || !portalPrompt} onClick={() => void confirmPortalTeleport()}>
              {teleporting ? "Indo..." : "Sim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(npcShopState)}
        onOpenChange={(open) => {
          if (!open) {
            setNpcShopState(null);
          }
        }}
      >
        <DialogContent
          className={`max-h-[88vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl ${
            npcShopState?.dialog.actionType === "SHOP_CRAFT" ? "sm:max-w-4xl" : "sm:max-w-3xl"
          }`}
        >
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/20 bg-slate-900/45">
                  {npcShopState?.dialog.actionType === "SHOP_BUY" ? (
                    <ShoppingBag className="h-5 w-5 text-slate-200" />
                  ) : (
                    <Wrench className="h-5 w-5 text-slate-200" />
                  )}
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg text-slate-100">
                    {npcShopState?.dialog.actionType === "SHOP_BUY" ? "Lojinha do NPC" : "Craft do NPC"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-300">
                    {npcShopState?.dialog.actionType === "SHOP_BUY"
                      ? "Mercadorias raras e suprimentos dignos de herois."
                      : "Forje equipamentos com os recursos do seu inventario."}
                  </DialogDescription>
                </div>
              </div>
              <Badge className="border-slate-200/20 bg-slate-900/45 text-slate-200">
                {npcShopState?.dialog.actionType === "SHOP_BUY" ? "Lojinha" : "Craft"}
              </Badge>
            </div>
          </DialogHeader>

          {npcShopState?.dialog.actionType === "SHOP_BUY" ? (
            <div className="space-y-3">
              {npcShopState.dialog.buyOffers.length === 0 ? (
                <div className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-center text-sm text-slate-400">
                  Nenhuma oferta disponivel no momento.
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {npcShopState.dialog.buyOffers.map((offer) => {
                  const sprite = itemCatalog.get(offer.itemId)?.imageData ?? null;
                  return (
                    <div key={offer.id} className="group rounded-md border border-slate-200/20 bg-slate-900/45 p-3 transition hover:border-slate-200/30">
                      <div className="flex items-start gap-3">
                        {sprite ? (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200/20 bg-slate-950/50">
                            <img src={sprite} alt={offer.itemName ?? offer.itemId} className="h-9 w-9 object-contain" />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200/20 bg-slate-950/50 text-xs text-slate-500">
                            ???
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-100">{offer.itemName ?? offer.itemId}</p>
                            <Badge className="shrink-0 border-slate-200/20 bg-slate-900/45 text-slate-200">x{offer.quantity}</Badge>
                          </div>
                          {offer.description ? <p className="text-xs text-slate-300">{offer.description}</p> : null}
                          <p className="text-xs text-slate-400">Custo: {offer.bitsCost.toLocaleString("pt-BR")} Bits</p>
                        </div>
                      </div>
                      <Button
                        className="mt-3 w-full border-slate-200/20 bg-slate-900/45 text-slate-200 hover:bg-slate-900/62"
                        variant="outline"
                        size="sm"
                        disabled={shopSubmittingKey === offer.id}
                        onClick={() => setConfirmShopAction({ type: "buy", offer })}
                      >
                        {shopSubmittingKey === offer.id ? "Processando..." : "Comprar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {npcShopState?.dialog.actionType === "SHOP_CRAFT" ? (
            <div className="space-y-3">
              {npcShopState.dialog.craftRecipes.length === 0 ? (
                <div className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-center text-sm text-slate-400">
                  Nenhuma receita disponivel no momento.
                </div>
              ) : null}
              {npcShopState.dialog.craftRecipes.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-300">Filtrar receitas</p>
                    <input
                      type="text"
                      value={craftSearch}
                      onChange={(event) => setCraftSearch(event.target.value)}
                      placeholder="Buscar por nome ou descricao..."
                      className="h-8 w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none focus:border-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    {npcShopState.dialog.craftRecipes
                      .filter((recipe) => {
                        const term = craftSearch.trim().toLowerCase();
                        if (!term) return true;
                        const name = (recipe.resultItemName ?? recipe.resultItemId).toLowerCase();
                        const desc = (recipe.description ?? "").toLowerCase();
                        return name.includes(term) || desc.includes(term);
                      })
                      .map((recipe) => {
                  const resultSprite = itemCatalog.get(recipe.resultItemId)?.imageData ?? null;
                  return (
                    <div
                      key={recipe.id}
                      className="flex flex-col gap-3 rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-xs text-slate-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {recipe.resultItemName ?? recipe.resultItemId}
                        </p>
                        {recipe.description ? <p className="text-xs text-slate-300">{recipe.description}</p> : null}
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {recipe.requirements.map((requirement, index) => {
                            const requirementSprite = itemCatalog.get(requirement.itemId)?.imageData ?? null;
                            return (
                              <div
                                key={`${recipe.id}_${index}`}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200/20 bg-slate-950/60 px-2 py-1"
                              >
                                {requirementSprite ? (
                                  <img
                                    src={requirementSprite}
                                    alt={requirement.itemName ?? requirement.itemId}
                                    className="h-5 w-5 object-contain"
                                  />
                                ) : (
                                  <div className="flex h-5 w-5 items-center justify-center rounded border border-slate-200/20 bg-slate-950 text-[9px] text-slate-500">
                                    ???
                                  </div>
                                )}
                                <span className="text-[11px]">
                                  {requirement.itemName ?? requirement.itemId} x{requirement.quantity}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:justify-center">
                        <div className="flex items-center gap-2 rounded-md border border-slate-200/20 bg-slate-950/60 px-3 py-1.5">
                          {resultSprite ? (
                            <img
                              src={resultSprite}
                              alt={recipe.resultItemName ?? recipe.resultItemId}
                              className="h-7 w-7 object-contain"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded border border-slate-200/20 bg-slate-950 text-[10px] text-slate-500">
                              ???
                            </div>
                          )}
                          <span className="text-[11px]">
                            x{recipe.resultQuantity}
                          </span>
                        </div>
                        <Button
                          className="w-full border-slate-200/20 bg-slate-900/45 text-slate-200 hover:bg-slate-900/62 sm:w-auto"
                          variant="outline"
                          size="sm"
                          disabled={shopSubmittingKey === recipe.id}
                          onClick={() => setConfirmShopAction({ type: "craft", recipe })}
                        >
                          {shopSubmittingKey === recipe.id ? "Processando..." : "Craftar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmShopAction)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmShopAction(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl sm:max-w-lg">
          {confirmShopAction ? (
            (() => {
              const isBuy = confirmShopAction.type === "buy";
              const itemId = isBuy ? confirmShopAction.offer.itemId : confirmShopAction.recipe.resultItemId;
              const itemName = isBuy
                ? confirmShopAction.offer.itemName ?? confirmShopAction.offer.itemId
                : confirmShopAction.recipe.resultItemName ?? confirmShopAction.recipe.resultItemId;
              const sprite = itemCatalog.get(itemId)?.imageData ?? null;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">{isBuy ? "Confirmar compra" : "Confirmar craft"}</DialogTitle>
                    <DialogDescription className="text-slate-300">
                      {isBuy ? "Confira os detalhes antes de comprar." : "Confira os itens necessarios antes de craftar."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-md border border-slate-200/20 bg-slate-900/45 p-3">
                      {sprite ? (
                        <img src={sprite} alt={itemName} className="h-12 w-12 object-contain" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200/20 bg-slate-950/50 text-xs text-slate-500">
                          ???
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-100">{itemName}</p>
                        <p className="text-xs text-slate-400">
                          {isBuy
                            ? `Quantidade: ${confirmShopAction.offer.quantity}`
                            : `Quantidade: ${confirmShopAction.recipe.resultQuantity}`}
                        </p>
                        {isBuy ? (
                          <p className="text-xs text-slate-400">
                            Custo: {confirmShopAction.offer.bitsCost.toLocaleString("pt-BR")} Bits
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {!isBuy ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-400">Requisitos</p>
                        <div className="flex flex-wrap gap-2">
                          {confirmShopAction.recipe.requirements.map((requirement, index) => {
                            const requirementSprite = itemCatalog.get(requirement.itemId)?.imageData ?? null;
                            return (
                              <div key={`${confirmShopAction.recipe.id}_${index}`} className="flex items-center gap-2 rounded-md border border-slate-200/20 bg-slate-950/50 px-2 py-1.5">
                                {requirementSprite ? (
                                  <img src={requirementSprite} alt={requirement.itemName ?? requirement.itemId} className="h-7 w-7 object-contain" />
                                ) : (
                                  <div className="flex h-7 w-7 items-center justify-center rounded border border-slate-200/20 bg-slate-950 text-[10px] text-slate-500">
                                    ???
                                  </div>
                                )}
                                <div className="text-xs text-slate-200">
                                  {requirement.itemName ?? requirement.itemId} x{requirement.quantity}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <DialogFooter className="gap-2 sm:gap-3">
                    <Button variant="outline" className="border-slate-200/20 bg-slate-900/45 text-slate-200 hover:bg-slate-900/62" disabled={actionSubmitting} onClick={() => setConfirmShopAction(null)}>
                      Cancelar
                    </Button>
                    <Button disabled={actionSubmitting} onClick={() => void handleConfirmShopAction()}>
                      {actionSubmitting ? "Confirmando..." : "Confirmar"}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(actionResult)}
        onOpenChange={(open) => {
          if (!open) {
            setActionResult(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">{actionResult?.title ?? ""}</DialogTitle>
            <DialogDescription className="text-slate-300">{actionResult?.description ?? ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setActionResult(null)}>Ok</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(questDetail)}
        onOpenChange={(open) => {
          if (!open) {
            setQuestDetail(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100">{questDetail?.title ?? "Quest"}</DialogTitle>
            <DialogDescription className="text-slate-300">{questDetail?.description ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {questDetail?.objectives.map((objective) => (
              <div key={objective.id} className="rounded-md border border-slate-200/20 bg-slate-900/45 p-2 text-xs text-slate-200">
                <p>{getQuestObjectiveLabel(objective)}</p>
                <p className="text-slate-400">
                  Progresso: {objective.current}/{objective.required}
                </p>
              </div>
            ))}
            {!questDetail ? null : (
              <div className="rounded-md border border-slate-200/20 bg-slate-900/45 p-2 text-xs text-slate-200">
                <p>
                  Recompensa: +{questDetail.rewardBits} Bits | +{questDetail.rewardXp} XP
                </p>
                {questDetail.rewardItems.length > 0 ? (
                  <div className="mt-1 space-y-1 text-slate-400">
                    {questDetail.rewardItems.map((reward) => (
                      <p key={reward.id}>
                        {reward.itemName ?? reward.itemId} x{reward.quantity}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            {!questDetail ? null : (
              <p className="text-xs text-slate-400">
                Status: {questDetail.status === "COMPLETED" ? "Concluida" : questDetail.turnInReady ? "Pronta para entrega" : "Em andamento"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

