import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Backpack, Coins, Lock, Maximize2, Minimize2, Sparkles, Users, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { evolveAdoptedAnima, getAdoptedAnimaEvolutionChain, listAdoptedAnimas, regressAdoptedAnima, setPrimaryAdoptedAnima as setPrimaryAdoptedAnimaRequest } from "@/lib/adocoes";
import { getUserInventory, updateInventoryHotbar, updateInventoryLayout, useInventoryItem } from "@/lib/inventario";
import { cn } from "@/lib/utils";
import type { AdoptedAnima, AdoptionEvolutionChain, EvolutionChainNode } from "@/types/adocao";
import type { InventoryItem, InventoryItemLayout, UserInventory } from "@/types/inventario";
import { AnimaStatsRadar, type RadarMetric } from "@/components/common/AnimaStatsRadar";
import { Button } from "@/components/ui/button";

type BagCategory = "all" | "consumable" | "quest" | "normal";

type FloatingBagMenuProps = {
  embedded?: boolean;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
};

const tabs: { key: BagCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "consumable", label: "Consume" },
  { key: "quest", label: "Quest" },
  { key: "normal", label: "Others" },
];

const rarityByType: Record<InventoryItem["item"]["type"], string> = {
  CONSUMIVEL: "border-emerald-500/60 bg-emerald-500/20 text-emerald-100",
  QUEST: "border-amber-500/60 bg-amber-500/20 text-amber-100",
  NORMAL: "border-sky-500/60 bg-sky-500/20 text-sky-100",
};

const HOTBAR_SLOT_COUNT = 9;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatSeconds = (value: number) => `${value.toFixed(2)}s`;
const toSpeedScore = (seconds: number) => 1 / Math.max(seconds, 0.05);
const toAnimaRadarMetrics = (anima: AdoptedAnima): RadarMetric[] => [
  {
    key: "attack",
    label: "ATK",
    value: anima.totalAttack,
    max: Math.max(1, anima.baseAnima.attack * 2),
    displayValue: anima.totalAttack.toString(),
  },
  {
    key: "defense",
    label: "DEF",
    value: anima.totalDefense,
    max: Math.max(1, anima.baseAnima.defense * 2),
    displayValue: anima.totalDefense.toString(),
  },
  {
    key: "hp",
    label: "HP",
    value: anima.totalMaxHp,
    max: Math.max(1, anima.baseAnima.maxHp * 2),
    displayValue: anima.totalMaxHp.toString(),
  },
  {
    key: "speed",
    label: "SPD",
    value: toSpeedScore(anima.totalAttackSpeedSeconds),
    max: toSpeedScore(0.2),
    displayValue: formatSeconds(anima.totalAttackSpeedSeconds),
  },
  {
    key: "crit",
    label: "CRT",
    value: anima.totalCritChance,
    max: 100,
    displayValue: formatPercent(anima.totalCritChance),
  },
  {
    key: "agility",
    label: "AGI",
    value: anima.baseAnima.agility,
    max: Math.max(1, anima.baseAnima.agility * 2),
    displayValue: anima.baseAnima.agility.toString(),
  },
];

const defaultInventory: UserInventory = {
  bits: 0,
  crystals: 0,
  totalSlots: 56,
  lockedSlotStart: 40,
  layout: [],
  hotbar: Array.from({ length: HOTBAR_SLOT_COUNT }, () => null),
  items: [],
  updatedAt: new Date().toISOString(),
};

const isHotbarData = (value: unknown): value is (string | null)[] =>
  Array.isArray(value) &&
  value.length === HOTBAR_SLOT_COUNT &&
  value.every((entry) => entry === null || typeof entry === "string");

const getDefaultHotbar = () => Array.from({ length: HOTBAR_SLOT_COUNT }, () => null as string | null);

const buildSlotsFromInventory = (inventory: UserInventory) => {
  const slots = Array.from({ length: inventory.totalSlots }, () => null as InventoryItem | null);
  const itemById = new Map(inventory.items.map((entry) => [entry.itemId, entry]));
  const used = new Set<string>();

  for (const position of inventory.layout) {
    const item = itemById.get(position.itemId);
    if (!item) continue;
    if (position.slot < 0 || position.slot >= inventory.totalSlots || position.slot >= inventory.lockedSlotStart) {
      continue;
    }
    if (slots[position.slot]) continue;
    slots[position.slot] = item;
    used.add(item.itemId);
  }

  for (const entry of inventory.items) {
    if (used.has(entry.itemId)) {
      continue;
    }
    const target = slots.findIndex((slot, index) => index < inventory.lockedSlotStart && slot === null);
    if (target < 0) {
      break;
    }
    slots[target] = entry;
    used.add(entry.itemId);
  }

  return slots;
};

const slotsToLayout = (slots: (InventoryItem | null)[], lockedSlotStart: number): InventoryItemLayout[] => {
  const layout: InventoryItemLayout[] = [];
  slots.forEach((entry, slot) => {
    if (!entry || slot >= lockedSlotStart) return;
    layout.push({
      itemId: entry.itemId,
      slot,
    });
  });
  return layout;
};

const categoryMatches = (category: BagCategory, entry: InventoryItem | null) => {
  if (!entry) return false;
  if (category === "all") return true;
  if (category === "consumable") return entry.item.type === "CONSUMIVEL";
  if (category === "quest") return entry.item.type === "QUEST";
  return entry.item.type === "NORMAL";
};

export const FloatingBagMenu = ({ embedded = false, focusMode = false, onToggleFocusMode }: FloatingBagMenuProps) => {
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BagCategory>("all");
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [windowOffset, setWindowOffset] = useState({ x: 0, y: 0 });
  const [animaDetailsOffset, setAnimaDetailsOffset] = useState({ x: 0, y: 0 });
  const [myAnimasOffset, setMyAnimasOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{
    active: boolean;
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
    target: "bag" | "currentAnima" | "myAnimas";
  }>({
    active: false,
    pointerX: 0,
    pointerY: 0,
    originX: 0,
    originY: 0,
    target: "bag",
  });
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
  const [inventory, setInventory] = useState<UserInventory>(defaultInventory);
  const [slotItems, setSlotItems] = useState<(InventoryItem | null)[]>(() => buildSlotsFromInventory(defaultInventory));
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUsingItem, setIsUsingItem] = useState(false);
  const [isAnimaDetailsOpen, setIsAnimaDetailsOpen] = useState(false);
  const [isMyAnimasOpen, setIsMyAnimasOpen] = useState(false);
  const [cooldownItemId, setCooldownItemId] = useState<string | null>(null);
  const [hotbarSlots, setHotbarSlots] = useState<(string | null)[]>(() => getDefaultHotbar());
  const [adoptedAnimas, setAdoptedAnimas] = useState<AdoptedAnima[]>([]);
  const [primaryAdoptedAnima, setPrimaryAdoptedAnima] = useState<AdoptedAnima | null>(null);
  const [selectingPrimaryId, setSelectingPrimaryId] = useState<string | null>(null);
  const [hoveredAnimaId, setHoveredAnimaId] = useState<string | null>(null);
  const [hoverCardPosition, setHoverCardPosition] = useState({ x: 0, y: 0 });
  const [evolutionChain, setEvolutionChain] = useState<AdoptionEvolutionChain | null>(null);
  const [evolutionSubmitting, setEvolutionSubmitting] = useState(false);

  const showFocusToggle = Boolean(onToggleFocusMode);

  const canDragFromInventory = !isSavingLayout && !isUsingItem;
  const canDragSlots = activeTab === "all" && canDragFromInventory;
  const inventoryItemById = useMemo(() => new Map(inventory.items.map((entry) => [entry.itemId, entry])), [inventory.items]);
  const hotbarItems = useMemo(
    () => hotbarSlots.map((itemId) => (itemId ? inventoryItemById.get(itemId) ?? null : null)),
    [hotbarSlots, inventoryItemById],
  );
  const visibleSlots = useMemo(
    () =>
      slotItems.map((entry, index) => {
        if (index >= inventory.lockedSlotStart) return null;
        if (!entry) return null;
        return categoryMatches(activeTab, entry) ? entry : null;
      }),
    [activeTab, inventory.lockedSlotStart, slotItems],
  );

  const firstVisibleSlot = useMemo(
    () => visibleSlots.findIndex((entry) => entry !== null),
    [visibleSlots],
  );

  const buildFallbackEvolutionChain = useCallback((adopted: AdoptedAnima): AdoptionEvolutionChain => {
    const chain: EvolutionChainNode[] = [];
    if (adopted.baseAnima.previousEvolution) {
      chain.push({
        ...adopted.baseAnima.previousEvolution,
        levelRequiredFromPrevious: null,
      });
    }
    chain.push({
      id: adopted.baseAnima.id,
      name: adopted.baseAnima.name,
      imageData: adopted.baseAnima.imageData,
      levelRequiredFromPrevious: null,
    });
    if (adopted.baseAnima.nextEvolution) {
      chain.push({
        ...adopted.baseAnima.nextEvolution,
        levelRequiredFromPrevious: adopted.baseAnima.nextEvolutionLevelRequired,
      });
    }
    const currentIndex = adopted.baseAnima.previousEvolution ? 1 : 0;
    return {
      adoptedAnimaId: adopted.id,
      currentBaseAnimaId: adopted.baseAnima.id,
      currentIndex,
      chain,
    };
  }, []);

  const syncEvolutionChain = useCallback(
    async (adopted: AdoptedAnima | null) => {
      if (!adopted) {
        setEvolutionChain(null);
        return;
      }
      try {
        const chain = await getAdoptedAnimaEvolutionChain(adopted.id);
        setEvolutionChain(chain);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setEvolutionChain(buildFallbackEvolutionChain(adopted));
          return;
        }
        setEvolutionChain(buildFallbackEvolutionChain(adopted));
      }
    },
    [buildFallbackEvolutionChain],
  );

  const unlockedEvolutionNodes = useMemo(() => {
    if (!primaryAdoptedAnima) {
      return [] as Array<EvolutionChainNode & { chainIndex: number }>;
    }
    if (!evolutionChain) {
      return [
        {
          id: primaryAdoptedAnima.baseAnima.id,
          name: primaryAdoptedAnima.baseAnima.name,
          imageData: primaryAdoptedAnima.baseAnima.imageData,
          levelRequiredFromPrevious: null,
          chainIndex: 0,
        },
      ];
    }
    const current = evolutionChain.currentIndex;
    const left = evolutionChain.chain.slice(0, current + 1).map((node, index) => ({ ...node, chainIndex: index }));
    const right: Array<EvolutionChainNode & { chainIndex: number }> = [];
    for (let index = current + 1; index < evolutionChain.chain.length; index += 1) {
      const node = evolutionChain.chain[index];
      if (!node) continue;
      const required = node.levelRequiredFromPrevious ?? Number.MAX_SAFE_INTEGER;
      if (primaryAdoptedAnima.level < required) {
        break;
      }
      right.push({ ...node, chainIndex: index });
    }
    return [...left, ...right];
  }, [evolutionChain, primaryAdoptedAnima]);

  const hoveredAnima = useMemo(
    () => (hoveredAnimaId ? adoptedAnimas.find((anima) => anima.id === hoveredAnimaId) ?? null : null),
    [adoptedAnimas, hoveredAnimaId],
  );
  const hoveredAnimaMetrics = useMemo(() => (hoveredAnima ? toAnimaRadarMetrics(hoveredAnima) : []), [hoveredAnima]);
  const primaryAnimaMetrics = useMemo(() => (primaryAdoptedAnima ? toAnimaRadarMetrics(primaryAdoptedAnima) : []), [primaryAdoptedAnima]);
  const hoverCardStyle = useMemo(() => {
    let left = hoverCardPosition.x + 8;
    let top = hoverCardPosition.y;
    if (typeof window !== "undefined") {
      const cardWidth = 420;
      const cardHeight = 290;
      const margin = 12;
      if (left + cardWidth + margin > window.innerWidth) {
        left = Math.max(margin, hoverCardPosition.x - cardWidth - 8);
      }
      if (top + cardHeight + margin > window.innerHeight) {
        top = Math.max(margin, window.innerHeight - cardHeight - margin);
      }
    }
    return { left, top };
  }, [hoverCardPosition]);

  const assignItemToHotbar = useCallback(async (targetIndex: number, itemId: string | null) => {
    if (targetIndex < 0 || targetIndex >= HOTBAR_SLOT_COUNT) {
      return;
    }
    const previous = [...hotbarSlots];
    const next = [...hotbarSlots];
    if (!itemId) {
      next[targetIndex] = null;
    } else {
      const existingIndex = next.findIndex((entry) => entry === itemId);
      if (existingIndex >= 0) {
        next[existingIndex] = null;
      }
      next[targetIndex] = itemId;
    }

    setHotbarSlots(next);
    try {
      const updatedInventory = await updateInventoryHotbar(next);
      setInventory(updatedInventory);
      setHotbarSlots(isHotbarData(updatedInventory.hotbar) ? updatedInventory.hotbar : getDefaultHotbar());
      setStatusMessage("Hotbar salva.");
    } catch (error) {
      setHotbarSlots(previous);
      if (error instanceof ApiError) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Falha ao salvar hotbar.");
      }
    }
  }, [hotbarSlots]);

  const loadInventory = useCallback(async () => {
    try {
      const nextInventory = await getUserInventory();
      setInventory(nextInventory);
      setSlotItems(buildSlotsFromInventory(nextInventory));
      setHotbarSlots(isHotbarData(nextInventory.hotbar) ? nextInventory.hotbar : getDefaultHotbar());
      setStatusMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Falha ao carregar inventario.");
      }
    } finally {
      setInventoryLoaded(true);
    }
  }, []);

  const loadPrimaryAdoptedAnima = useCallback(async () => {
    try {
      const animas = await listAdoptedAnimas();
      setAdoptedAnimas(animas);
      const primary = animas.find((item) => item.isPrimary) ?? null;
      setPrimaryAdoptedAnima(primary);
      await syncEvolutionChain(primary);
    } catch (error) {
      setEvolutionChain(null);
      if (error instanceof ApiError) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Falha ao carregar dados de evolucao.");
      }
    }
  }, [syncEvolutionChain]);

  const handleSelectPrimaryAnima = useCallback(
    async (nextPrimary: AdoptedAnima) => {
      if (!nextPrimary || selectingPrimaryId || nextPrimary.isPrimary) {
        return;
      }
      const previousPrimary = primaryAdoptedAnima;
      setSelectingPrimaryId(nextPrimary.id);
      try {
        const updated = await setPrimaryAdoptedAnimaRequest(nextPrimary.id);
        setAdoptedAnimas((current) =>
          current.map((anima) =>
            anima.id === updated.id ? { ...anima, ...updated, isPrimary: true } : { ...anima, isPrimary: false },
          ),
        );
        setPrimaryAdoptedAnima(updated);
        await syncEvolutionChain(updated);
        window.dispatchEvent(new CustomEvent("adoption:changed"));
        if (!previousPrimary || previousPrimary.id !== updated.id) {
          window.dispatchEvent(
            new CustomEvent("explore:anima-evolved", {
              detail: {
                action: "swapped",
                from: previousPrimary ?? updated,
                to: updated,
              },
            }),
          );
        }
        setStatusMessage(`${updated.nickname} agora e o anima ativo.`);
      } catch (error) {
        if (error instanceof ApiError) {
          setStatusMessage(error.message);
        } else {
          setStatusMessage("Falha ao trocar anima ativo.");
        }
      } finally {
        setSelectingPrimaryId(null);
      }
    },
    [primaryAdoptedAnima, selectingPrimaryId, syncEvolutionChain],
  );

  const persistLayout = useCallback(
    async (nextSlots: (InventoryItem | null)[]) => {
      setIsSavingLayout(true);
      try {
        const nextLayout = slotsToLayout(nextSlots, inventory.lockedSlotStart);
        const updatedInventory = await updateInventoryLayout(nextLayout);
        setInventory(updatedInventory);
        setStatusMessage("Layout salvo.");
      } catch (error) {
        if (error instanceof ApiError) {
          setStatusMessage(error.message);
        } else {
          setStatusMessage("Falha ao salvar layout.");
        }
      } finally {
        setIsSavingLayout(false);
      }
    },
    [inventory.lockedSlotStart],
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    const onInventoryChanged = () => {
      void loadInventory();
    };
    window.addEventListener("inventory:changed", onInventoryChanged as EventListener);
    return () => window.removeEventListener("inventory:changed", onInventoryChanged as EventListener);
  }, [loadInventory]);

  useEffect(() => {
    const onAdoptionChanged = () => {
      void loadPrimaryAdoptedAnima();
    };
    window.addEventListener("adoption:changed", onAdoptionChanged as EventListener);
    return () => window.removeEventListener("adoption:changed", onAdoptionChanged as EventListener);
  }, [loadPrimaryAdoptedAnima]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (event.key === "Escape") {
        let closedAny = false;
        if (isMyAnimasOpen) {
          setIsMyAnimasOpen(false);
          setHoveredAnimaId(null);
          closedAny = true;
        }
        if (isAnimaDetailsOpen) {
          setIsAnimaDetailsOpen(false);
          closedAny = true;
        }
        if (isBagOpen) {
          setIsBagOpen(false);
          closedAny = true;
        }
        if (closedAny) {
          event.preventDefault();
        }
        return;
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setIsBagOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnimaDetailsOpen, isBagOpen, isMyAnimasOpen]);

  useEffect(() => {
    if (!isBagOpen) {
      return;
    }

    if (!inventoryLoaded) {
      void loadInventory();
    }

    setSelectedSlot((current) => {
      if (visibleSlots[current]) {
        return current;
      }
      return firstVisibleSlot >= 0 ? firstVisibleSlot : 0;
    });
  }, [firstVisibleSlot, inventoryLoaded, isBagOpen, loadInventory, visibleSlots]);

  useEffect(() => {
    void loadPrimaryAdoptedAnima();
  }, [loadPrimaryAdoptedAnima]);

  useEffect(() => {
    if (!isAnimaDetailsOpen && !isMyAnimasOpen) {
      return;
    }
    void loadPrimaryAdoptedAnima();
  }, [isAnimaDetailsOpen, isMyAnimasOpen, loadPrimaryAdoptedAnima]);

  useEffect(() => {
    if (!dragState.active) return;

    const handleMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragState.pointerX;
      const deltaY = event.clientY - dragState.pointerY;
      const nextOffset = {
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      };
      if (dragState.target === "bag") {
        setWindowOffset(nextOffset);
        return;
      }
      if (dragState.target === "currentAnima") {
        setAnimaDetailsOffset(nextOffset);
        return;
      }
      setMyAnimasOffset(nextOffset);
    };

    const handleUp = () => {
      setDragState((current) => ({ ...current, active: false }));
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState]);

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>, target: "bag" | "currentAnima" | "myAnimas") => {
    event.preventDefault();
    const sourceOffset = target === "bag" ? windowOffset : target === "currentAnima" ? animaDetailsOffset : myAnimasOffset;
    setDragState({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: sourceOffset.x,
      originY: sourceOffset.y,
      target,
    });
  };

  const handleSlotDrop = (targetIndex: number) => {
    if (dragItemIndex === null || !canDragSlots) {
      return;
    }
    if (
      targetIndex >= inventory.lockedSlotStart ||
      dragItemIndex >= inventory.lockedSlotStart ||
      targetIndex === dragItemIndex
    ) {
      setDragItemIndex(null);
      return;
    }

    setSlotItems((current) => {
      const next = [...current];
      const source = next[dragItemIndex];
      next[dragItemIndex] = next[targetIndex];
      next[targetIndex] = source;
      void persistLayout(next);
      return next;
    });
    setSelectedSlot(targetIndex);
    setDragItemIndex(null);
  };

  const handleUseItem = useCallback(async (item: InventoryItem, quantity: number) => {
    if (!item || item.item.type !== "CONSUMIVEL" || quantity <= 0) {
      return;
    }

    const safeQuantity = Math.min(quantity, item.quantity);
    setIsUsingItem(true);
    try {
      const result = await useInventoryItem(item.itemId, safeQuantity);
      setInventory(result.inventory);
      setSlotItems(buildSlotsFromInventory(result.inventory));
      if (result.appliedEffect) {
        window.dispatchEvent(
          new CustomEvent("explore:consumable-used", {
            detail: result.appliedEffect,
          }),
        );
        setStatusMessage(
          `${result.appliedEffect.nickname}: +${result.appliedEffect.bonusAttackAdded} ATK, +${result.appliedEffect.bonusDefenseAdded} DEF, +${result.appliedEffect.bonusMaxHpAdded} HPMax, cura ${result.appliedEffect.healedHp}`,
        );
      } else {
        setStatusMessage("Item usado.");
      }
      setCooldownItemId(item.itemId);
      window.setTimeout(() => {
        setCooldownItemId((current) => (current === item.itemId ? null : current));
      }, 500);
    } catch (error) {
      if (error instanceof ApiError) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Falha ao usar item.");
      }
    } finally {
      setIsUsingItem(false);
    }
  }, []);

  const triggerHotbarSlot = useCallback(
    async (hotbarIndex: number) => {
      const entry = hotbarItems[hotbarIndex] ?? null;
      if (!entry) {
        return;
      }
      if (entry.item.type !== "CONSUMIVEL") {
        setStatusMessage("A hotbar aceita apenas itens consumiveis.");
        return;
      }
      if (isUsingItem || cooldownItemId === entry.itemId) {
        return;
      }
      await handleUseItem(entry, 1);
    },
    [cooldownItemId, handleUseItem, hotbarItems, isUsingItem],
  );

  useEffect(() => {
    const handleHotbarKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (!/^[1-9]$/.test(event.key)) return;

      const hotbarIndex = Number(event.key) - 1;
      if (!hotbarItems[hotbarIndex]) {
        return;
      }
      event.preventDefault();
      void triggerHotbarSlot(hotbarIndex);
    };

    window.addEventListener("keydown", handleHotbarKeyDown);
    return () => window.removeEventListener("keydown", handleHotbarKeyDown);
  }, [hotbarItems, triggerHotbarSlot]);

  const triggerEvolutionHotbarSlot = useCallback(
    async (slotIndex: number) => {
      if (!primaryAdoptedAnima || !evolutionChain || evolutionSubmitting) {
        return;
      }
      setEvolutionSubmitting(true);
      const selected = unlockedEvolutionNodes[slotIndex];
      if (!selected) {
        setEvolutionSubmitting(false);
        return;
      }

      try {
        const currentIndex = evolutionChain.currentIndex;
        const clickedIndex = evolutionChain.chain.findIndex((node) => node.id === selected.id);
        if (clickedIndex < 0 || clickedIndex === currentIndex) {
          return;
        }
        const delta = clickedIndex - currentIndex;
        let working = primaryAdoptedAnima;

        if (delta < 0) {
          const totalSteps = Math.abs(delta);
          for (let step = 0; step < totalSteps; step += 1) {
            if (!working.baseAnima.previousEvolution) {
              break;
            }
            const updated = await regressAdoptedAnima(working.id);
            working = updated;
          }
          setPrimaryAdoptedAnima(working);
          await syncEvolutionChain(working);
          setStatusMessage(`${primaryAdoptedAnima.nickname} regrediu para ${working.baseAnima.name}.`);
          window.dispatchEvent(
            new CustomEvent("explore:anima-evolved", {
              detail: {
                action: "regressed",
                from: primaryAdoptedAnima,
                to: working,
              },
            }),
          );
          return;
        }

        for (let target = currentIndex + 1; target <= clickedIndex; target += 1) {
          const node = evolutionChain.chain[target];
          if (!node) break;
          const required = node.levelRequiredFromPrevious ?? Number.MAX_SAFE_INTEGER;
          if (working.level < required) {
            setStatusMessage(`Nivel insuficiente para chegar em ${node.name}. Necessario nivel ${required}.`);
            return;
          }
          const updated = await evolveAdoptedAnima(working.id);
          working = updated;
        }

        setPrimaryAdoptedAnima(working);
        await syncEvolutionChain(working);
        setStatusMessage(`${primaryAdoptedAnima.nickname} evoluiu para ${working.baseAnima.name}.`);
        window.dispatchEvent(
          new CustomEvent("explore:anima-evolved", {
            detail: {
              action: "evolved",
              from: primaryAdoptedAnima,
              to: working,
            },
          }),
        );
      } finally {
        setEvolutionSubmitting(false);
      }
    },
    [evolutionChain, evolutionSubmitting, primaryAdoptedAnima, setEvolutionSubmitting, syncEvolutionChain, unlockedEvolutionNodes],
  );

  const buildItemTooltip = (entry: InventoryItem) => {
    const parts: string[] = [];
    if (entry.item.description) parts.push(entry.item.description);
    const stats: string[] = [];
    if (entry.item.healPercentMaxHp) stats.push(`HP ${entry.item.healPercentMaxHp}%`);
    if (entry.item.bonusAttack) stats.push(`ATK +${entry.item.bonusAttack}`);
    if (entry.item.bonusDefense) stats.push(`DEF +${entry.item.bonusDefense}`);
    if (entry.item.bonusMaxHp) stats.push(`HPMax +${entry.item.bonusMaxHp}`);
    if (stats.length > 0) parts.push(stats.join(" | "));
    return [`${entry.item.name} (x${entry.quantity})`, ...parts].join("\n");
  };

  return (
    <>
      <div className={cn(embedded ? "absolute bottom-4 right-4 z-30" : "fixed bottom-5 right-5 z-50")}>
        <div
          className={cn(
            "grid gap-2 rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/92 via-slate-900/90 to-slate-950/92 p-2 shadow-[0_22px_48px_-22px_rgba(0,0,0,0.75)] backdrop-blur-xl",
            showFocusToggle ? "grid-cols-4" : "grid-cols-3",
          )}
        >
          <div className="flex min-w-[72px] flex-col items-center justify-center">
            <Button
              type="button"
              size="icon"
              variant={isBagOpen ? "default" : "outline"}
              className="mx-auto h-10 w-10 rounded-lg border-slate-300/20 bg-slate-900/55 text-slate-100 hover:bg-slate-900/75"
              onClick={() => setIsBagOpen((current) => !current)}
              aria-label="Abrir inventario de itens"
            >
              <Backpack className="h-5 w-5" />
            </Button>
            <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Inventario</p>
          </div>
          <div className="flex min-w-[72px] flex-col items-center justify-center">
            <Button
              type="button"
              size="icon"
              variant={isAnimaDetailsOpen ? "default" : "outline"}
              className="mx-auto h-10 w-10 rounded-lg border-slate-300/20 bg-slate-900/55 text-slate-100 hover:bg-slate-900/75"
              onClick={() => setIsAnimaDetailsOpen(true)}
              aria-label="Abrir detalhes do anima atual"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Anima Atual</p>
          </div>
          <div className="flex min-w-[72px] flex-col items-center justify-center">
            <Button
              type="button"
              size="icon"
              variant={isMyAnimasOpen ? "default" : "outline"}
              className="mx-auto h-10 w-10 rounded-lg border-slate-300/20 bg-slate-900/55 text-slate-100 hover:bg-slate-900/75"
              onClick={() => setIsMyAnimasOpen(true)}
              aria-label="Abrir meus animas"
            >
              <Users className="h-5 w-5" />
            </Button>
            <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Meus Animas</p>
          </div>
          {showFocusToggle ? (
            <div className="flex min-w-[72px] flex-col items-center justify-center">
              <Button
                type="button"
                size="icon"
                variant={focusMode ? "default" : "outline"}
                className="mx-auto h-10 w-10 rounded-lg border-slate-300/20 bg-slate-900/55 text-slate-100 hover:bg-slate-900/75"
                onClick={onToggleFocusMode}
                aria-label={focusMode ? "Sair do modo foco" : "Ativar modo foco"}
              >
                {focusMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
              <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Foco</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn(embedded ? "absolute bottom-4 left-1/2 z-30 -translate-x-1/2" : "fixed bottom-5 left-1/2 z-50 -translate-x-1/2")}>
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/20 bg-gradient-to-br from-slate-950/86 via-slate-900/84 to-slate-950/86 p-1.5 shadow-[0_16px_34px_-20px_rgba(0,0,0,0.78)] backdrop-blur-xl">
            {unlockedEvolutionNodes.map((node, index) => {
              const currentIndex = evolutionChain?.currentIndex ?? 0;
              const delta = node.chainIndex - currentIndex;
              const isCurrent = delta === 0;
              const isClickable = delta !== 0;
              const disabled = evolutionSubmitting || !isClickable;
              const hint = isCurrent ? `${node.name} (Atual)` : delta < 0 ? `Regredir para ${node.name}` : `Evoluir para ${node.name}`;

              return (
                <button
                  key={`evolution-shortcut-${node.id}`}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "relative h-9 w-9 overflow-hidden rounded-md border transition-colors",
                    isCurrent ? "border-violet-300/70 bg-violet-400/16" : "border-slate-300/20 bg-slate-900/62",
                    !disabled ? "hover:border-slate-100/50 hover:bg-slate-800/65" : "opacity-70",
                  )}
                  onClick={() => void triggerEvolutionHotbarSlot(index)}
                  title={hint}
                >
                  {node?.imageData ? (
                    <img src={node.imageData} alt={node.name} className="h-full w-full p-[4px] object-contain" />
                  ) : (
                    <span className="flex h-full items-center justify-center px-1 text-center text-[8px] font-semibold leading-tight text-slate-200">
                      {node.name.slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
            {unlockedEvolutionNodes.length === 0 ? (
              <p className="px-2 text-[11px] text-slate-400">Sem evolucoes desbloqueadas.</p>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/88 via-slate-900/86 to-slate-950/88 p-2 shadow-[0_22px_48px_-22px_rgba(0,0,0,0.78)] backdrop-blur-xl">
            {hotbarItems.map((entry, index) => {
              const itemId = hotbarSlots[index];
              const disabled = Boolean(entry && cooldownItemId === entry.itemId);
              return (
                <button
                  key={`hotbar-slot-${index}`}
                  type="button"
                  draggable={Boolean(entry)}
                  disabled={disabled}
                  className={cn(
                    "relative h-11 w-11 overflow-hidden rounded-lg border text-[10px] transition-colors",
                    "border-slate-300/20 bg-slate-900/65 hover:border-slate-300/40",
                    entry ? rarityByType[entry.item.type] : undefined,
                  )}
                  title={entry ? buildItemTooltip(entry) : `Hotkey ${index + 1}`}
                  onClick={() => void triggerHotbarSlot(index)}
                  onContextMenu={(event) => {
                    if (!itemId) return;
                    event.preventDefault();
                    void assignItemToHotbar(index, null);
                  }}
                  onDragStart={(event) => {
                    if (!entry) return;
                    event.dataTransfer.setData("application/x-anima-item-id", entry.itemId);
                    event.dataTransfer.setData("text/plain", entry.itemId);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    const canDrop = event.dataTransfer.types.includes("application/x-anima-item-id") || dragItemIndex !== null;
                    if (!canDrop) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromTransfer = event.dataTransfer.getData("application/x-anima-item-id") || event.dataTransfer.getData("text/plain");
                    const fromDragIndex = dragItemIndex !== null ? slotItems[dragItemIndex]?.itemId ?? null : null;
                    const droppedItemId = fromTransfer || fromDragIndex;
                    if (!droppedItemId || !inventoryItemById.has(droppedItemId)) {
                      setDragItemIndex(null);
                      return;
                    }
                    void assignItemToHotbar(index, droppedItemId);
                    setDragItemIndex(null);
                  }}
                >
                  <span className="pointer-events-none absolute left-1 top-0.5 rounded bg-black/55 px-1 text-[9px] font-semibold leading-none text-slate-100">
                    {index + 1}
                  </span>
                  {entry ? (
                    <>
                      {entry.item.imageData ? (
                        <img src={entry.item.imageData} alt={entry.item.name} className="h-full w-full p-[4px] object-contain" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] font-semibold">
                          {entry.item.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-[1px] text-[9px] leading-none text-slate-100">
                        {entry.quantity}
                      </span>
                      {disabled ? <span className="pointer-events-none absolute inset-0 rounded-lg bg-black/45" /> : null}
                    </>
                  ) : (
                    <span className="pointer-events-none flex h-full items-center justify-center text-[11px] font-semibold text-slate-500">{index + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isBagOpen ? (
        <div
          className={cn(embedded ? "absolute bottom-20 right-4 z-30" : "fixed bottom-24 right-5 z-50")}
          style={{ transform: `translate3d(${windowOffset.x}px, ${windowOffset.y}px, 0)` }}
        >
          <div className="w-[540px] max-w-[min(94vw,540px)] overflow-hidden rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 shadow-[0_26px_52px_-22px_rgba(0,0,0,0.82)] backdrop-blur-xl">
            <div
              className="flex cursor-move items-center justify-between border-b border-slate-300/20 bg-slate-900/70 px-3 py-2"
              onPointerDown={(event) => handleHeaderPointerDown(event, "bag")}
            >
              <p className="text-sm font-semibold text-slate-100">Bag</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setIsBagOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b border-slate-300/20 bg-slate-900/55 px-2 py-1.5">
              <div className="flex flex-wrap gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "rounded border px-2 py-1 text-[11px] leading-none transition-colors",
                      activeTab === tab.key
                        ? "border-sky-300/45 bg-sky-500/18 text-sky-100"
                        : "border-slate-300/20 bg-slate-900/55 text-slate-300 hover:border-slate-300/35 hover:text-slate-100",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/35 p-2">
              <div className="grid grid-cols-8 gap-1 rounded-lg border border-slate-300/20 bg-slate-900/45 p-1.5 backdrop-blur-sm">
                {Array.from({ length: inventory.totalSlots }, (_, index) => {
                  const visibleItem = visibleSlots[index] ?? null;
                  const rawItem = slotItems[index] ?? null;
                  const isLocked = index >= inventory.lockedSlotStart;
                  const isSelected = selectedSlot === index && !isLocked;
                  const draggable = canDragFromInventory && !isLocked && Boolean(rawItem);

                  return (
                    <button
                      key={`bag-slot-${index}`}
                      type="button"
                      disabled={isLocked || Boolean(visibleItem && cooldownItemId === visibleItem.itemId)}
                      draggable={draggable}
                      className={cn(
                        "relative aspect-square rounded-[4px] border text-[10px] transition-colors",
                        isLocked
                          ? "cursor-not-allowed border-slate-800 bg-slate-900/75 text-slate-700"
                          : "border-slate-300/20 bg-slate-900/70 hover:border-slate-300/35",
                        isSelected ? "border-sky-400 bg-sky-500/20" : undefined,
                        visibleItem ? rarityByType[visibleItem.item.type] : undefined,
                      )}
                      onClick={() => {
                        if (!isLocked) setSelectedSlot(index);
                      }}
                      onContextMenu={(event) => {
                        if (!visibleItem || isLocked || visibleItem.item.type !== "CONSUMIVEL") return;
                        event.preventDefault();
                        if (isUsingItem || cooldownItemId === visibleItem.itemId) return;
                        void handleUseItem(visibleItem, 1);
                      }}
                      onDragStart={(event) => {
                        if (!draggable) return;
                        if (rawItem) {
                          event.dataTransfer.setData("application/x-anima-item-id", rawItem.itemId);
                          event.dataTransfer.setData("text/plain", rawItem.itemId);
                        }
                        event.dataTransfer.effectAllowed = "move";
                        setDragItemIndex(index);
                      }}
                      onDragOver={(event) => {
                        if (!canDragSlots || isLocked || dragItemIndex === null) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleSlotDrop(index);
                      }}
                      onDragEnd={() => setDragItemIndex(null)}
                      title={visibleItem ? buildItemTooltip(visibleItem) : undefined}
                    >
                      {isLocked ? (
                        <span className="flex h-full items-center justify-center">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : visibleItem ? (
                        <>
                          {visibleItem.item.imageData ? (
                            <img src={visibleItem.item.imageData} alt={visibleItem.item.name} className="h-full w-full p-[3px] object-contain" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[10px] font-semibold">
                              {visibleItem.item.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-[1px] text-[9px] leading-none text-slate-100">
                            {visibleItem.quantity}
                          </span>
                          {cooldownItemId === visibleItem.itemId ? (
                            <span className="pointer-events-none absolute inset-0 rounded-[4px] bg-black/45" />
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-700">-</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-300/20 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
              <div className="min-w-0">
                <p className="truncate text-[10px] text-slate-400">
                  {isSavingLayout
                    ? "Salvando layout..."
                    : statusMessage ?? (activeTab === "all" ? "Arraste e solte para reorganizar." : "Troque para aba All para arrastar itens.")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Coins className="h-3.5 w-3.5" />
                  {inventory.bits.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAnimaDetailsOpen ? (
        <div
          className={cn(embedded ? "absolute bottom-20 left-4 z-30" : "fixed bottom-24 left-5 z-50")}
          style={{ transform: `translate3d(${animaDetailsOffset.x}px, ${animaDetailsOffset.y}px, 0)` }}
        >
          <div className="w-[620px] max-w-[min(94vw,620px)] overflow-hidden rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 shadow-[0_26px_52px_-22px_rgba(0,0,0,0.82)] backdrop-blur-xl">
            <div
              className="flex cursor-move items-center justify-between border-b border-slate-300/20 bg-slate-900/70 px-3 py-2"
              onPointerDown={(event) => handleHeaderPointerDown(event, "currentAnima")}
            >
              <p className="text-sm font-semibold text-slate-100">Detalhes do anima atual</p>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100" onClick={() => setIsAnimaDetailsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              {!primaryAdoptedAnima ? (
                <p className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-sm text-slate-300">Defina um anima principal para visualizar os detalhes.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 rounded-lg border border-slate-200/20 bg-slate-900/45 p-3 sm:grid-cols-[96px_1fr]">
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200/20 bg-slate-950/55">
                      {primaryAdoptedAnima.baseAnima.imageData ? (
                        <img src={primaryAdoptedAnima.baseAnima.imageData} alt={primaryAdoptedAnima.baseAnima.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="text-xs text-slate-500">Sem sprite</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-slate-100">{primaryAdoptedAnima.nickname}</p>
                      <p className="truncate text-xs text-slate-400">{primaryAdoptedAnima.baseAnima.name}</p>
                      <p className="text-xs text-slate-300">Nivel {primaryAdoptedAnima.level} | XP {primaryAdoptedAnima.experience}/{primaryAdoptedAnima.experienceMax}</p>
                      <p className="text-xs text-slate-300">HP {Math.max(0, Math.round(primaryAdoptedAnima.currentHp))}/{primaryAdoptedAnima.totalMaxHp}</p>
                    </div>
                  </div>
                  <AnimaStatsRadar metrics={primaryAnimaMetrics} title="Radar de status" className="border-slate-200/20 bg-slate-900/45" />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isMyAnimasOpen ? (
        <>
          <div
          className={cn(embedded ? "absolute bottom-20 left-20 z-30" : "fixed bottom-24 left-24 z-50")}
          style={{ transform: `translate3d(${myAnimasOffset.x}px, ${myAnimasOffset.y}px, 0)` }}
        >
          <div className="w-[680px] max-w-[min(94vw,680px)] overflow-hidden rounded-2xl border border-slate-200/20 bg-gradient-to-br from-slate-950/88 via-slate-900/86 to-slate-950/88 shadow-[0_26px_52px_-22px_rgba(0,0,0,0.82)] backdrop-blur-xl">
            <div
              className="flex cursor-move items-center justify-between border-b border-slate-300/20 bg-slate-900/70 px-3 py-2"
              onPointerDown={(event) => handleHeaderPointerDown(event, "myAnimas")}
            >
              <p className="text-sm font-semibold text-slate-100">Meus Animas</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => {
                  setIsMyAnimasOpen(false);
                  setHoveredAnimaId(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              {adoptedAnimas.length === 0 ? (
                <p className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-sm text-slate-300">Nenhum anima adotado ainda.</p>
              ) : (
                <div className="relative">
                  <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {adoptedAnimas.map((anima) => {
                      const isActive = anima.isPrimary;
                      const isSelecting = selectingPrimaryId === anima.id;
                      return (
                        <button
                          key={anima.id}
                          type="button"
                          disabled={isSelecting || (Boolean(selectingPrimaryId) && !isActive)}
                          className={cn(
                            "group rounded-xl border px-3 py-2 text-left transition",
                            isActive
                              ? "border-emerald-300/45 bg-emerald-500/10"
                              : "border-slate-300/20 bg-slate-900/45 hover:border-slate-100/35 hover:bg-slate-900/62",
                            isSelecting ? "opacity-80" : undefined,
                          )}
                          onClick={() => void handleSelectPrimaryAnima(anima)}
                          onMouseEnter={(event) => {
                            setHoveredAnimaId(anima.id);
                            const rect = event.currentTarget.getBoundingClientRect();
                            setHoverCardPosition({ x: rect.right, y: rect.top });
                          }}
                          onMouseMove={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setHoverCardPosition({ x: rect.right, y: rect.top });
                          }}
                          onMouseLeave={() => setHoveredAnimaId((current) => (current === anima.id ? null : current))}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200/20 bg-slate-950/60">
                              {anima.baseAnima.imageData ? (
                                <img src={anima.baseAnima.imageData} alt={anima.baseAnima.name} className="h-full w-full object-contain p-1" />
                              ) : (
                                <span className="text-[10px] text-slate-500">Sem sprite</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold">{anima.nickname}</p>
                                {isActive ? <span className="text-[10px] font-semibold text-emerald-300">Ativo</span> : null}
                              </div>
                              <p className="truncate text-[11px] text-slate-400">{anima.baseAnima.name}</p>
                              <p className="text-[11px] text-slate-300">Nv {anima.level} | HP {Math.max(0, Math.round(anima.currentHp))}/{anima.totalMaxHp}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                            <span>ATK {anima.totalAttack}</span>
                            <span>DEF {anima.totalDefense}</span>
                            <span>{isSelecting ? "Trocando..." : isActive ? "Em uso" : "Clique para usar"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
          {hoveredAnima ? (
            <div className="pointer-events-none fixed z-[90] w-[420px] rounded-xl border border-slate-200/25 bg-slate-950/80 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl" style={hoverCardStyle}>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200/20 bg-slate-900/65">
                  {hoveredAnima.baseAnima.imageData ? (
                    <img src={hoveredAnima.baseAnima.imageData} alt={hoveredAnima.baseAnima.name} className="h-full w-full object-contain p-1" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">{hoveredAnima.nickname}</p>
                  <p className="truncate text-[11px] text-slate-400">Nivel {hoveredAnima.level} | {hoveredAnima.baseAnima.name}</p>
                </div>
              </div>
              <AnimaStatsRadar metrics={hoveredAnimaMetrics} title="Detalhes do anima" size={180} className="border-slate-200/15 bg-slate-900/40 p-2" />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
};
