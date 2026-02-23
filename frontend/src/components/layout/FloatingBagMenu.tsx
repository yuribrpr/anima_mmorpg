import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Backpack, ClipboardList, Coins, Lock, Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { evolveAdoptedAnima, getAdoptedAnimaEvolutionChain, listAdoptedAnimas, regressAdoptedAnima } from "@/lib/adocoes";
import { getUserInventory, updateInventoryHotbar, updateInventoryLayout, useInventoryItem } from "@/lib/inventario";
import { listPlayerQuests } from "@/lib/npcs";
import { cn } from "@/lib/utils";
import type { AdoptedAnima, AdoptionEvolutionChain, EvolutionChainNode } from "@/types/adocao";
import type { InventoryItem, InventoryItemLayout, UserInventory } from "@/types/inventario";
import type { PlayerQuest } from "@/types/npc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [dragState, setDragState] = useState<{ active: boolean; pointerX: number; pointerY: number; originX: number; originY: number }>({
    active: false,
    pointerX: 0,
    pointerY: 0,
    originX: 0,
    originY: 0,
  });
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
  const [inventory, setInventory] = useState<UserInventory>(defaultInventory);
  const [slotItems, setSlotItems] = useState<(InventoryItem | null)[]>(() => buildSlotsFromInventory(defaultInventory));
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUsingItem, setIsUsingItem] = useState(false);
  const [isQuestOpen, setIsQuestOpen] = useState(false);
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [activeQuests, setActiveQuests] = useState<PlayerQuest[]>([]);
  const [completedQuests, setCompletedQuests] = useState<PlayerQuest[]>([]);
  const [questLoading, setQuestLoading] = useState(false);
  const [questErrorMessage, setQuestErrorMessage] = useState<string | null>(null);
  const [cooldownItemId, setCooldownItemId] = useState<string | null>(null);
  const [useDialogItem, setUseDialogItem] = useState<InventoryItem | null>(null);
  const [useDialogQuantity, setUseDialogQuantity] = useState<string>("1");
  const [useDialogSubmitting, setUseDialogSubmitting] = useState(false);
  const [hotbarSlots, setHotbarSlots] = useState<(string | null)[]>(() => getDefaultHotbar());
  const [primaryAdoptedAnima, setPrimaryAdoptedAnima] = useState<AdoptedAnima | null>(null);
  const [evolutionChain, setEvolutionChain] = useState<AdoptionEvolutionChain | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionSubmitting, setEvolutionSubmitting] = useState(false);
  const [evolutionErrorMessage, setEvolutionErrorMessage] = useState<string | null>(null);

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
  const canEvolve = Boolean(
    primaryAdoptedAnima?.baseAnima.nextEvolution &&
      primaryAdoptedAnima.level >= primaryAdoptedAnima.baseAnima.nextEvolutionLevelRequired,
  );
  const canRegress = Boolean(primaryAdoptedAnima?.baseAnima.previousEvolution);

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

  const loadQuests = useCallback(async () => {
    setQuestLoading(true);
    try {
      const quests = await listPlayerQuests();
      setActiveQuests(quests.activeQuests);
      setCompletedQuests(quests.completedQuests);
      setQuestErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setQuestErrorMessage(error.message);
      } else {
        setQuestErrorMessage("Falha ao carregar quests.");
      }
    } finally {
      setQuestLoading(false);
    }
  }, []);

  const loadPrimaryAdoptedAnima = useCallback(async () => {
    setEvolutionLoading(true);
    try {
      const animas = await listAdoptedAnimas();
      const primary = animas.find((item) => item.isPrimary) ?? null;
      setPrimaryAdoptedAnima(primary);
      await syncEvolutionChain(primary);
      setEvolutionErrorMessage(null);
    } catch (error) {
      setEvolutionChain(null);
      if (error instanceof ApiError) {
        setEvolutionErrorMessage(error.message);
      } else {
        setEvolutionErrorMessage("Falha ao carregar dados de evolucao.");
      }
    } finally {
      setEvolutionLoading(false);
    }
  }, [syncEvolutionChain]);

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
    const onQuestChanged = () => {
      void loadQuests();
    };
    window.addEventListener("quest:changed", onQuestChanged as EventListener);
    return () => window.removeEventListener("quest:changed", onQuestChanged as EventListener);
  }, [loadQuests]);

  useEffect(() => {
    const onAdoptionChanged = () => {
      if (isEvolutionOpen) {
        void loadPrimaryAdoptedAnima();
      }
    };
    window.addEventListener("adoption:changed", onAdoptionChanged as EventListener);
    return () => window.removeEventListener("adoption:changed", onAdoptionChanged as EventListener);
  }, [isEvolutionOpen, loadPrimaryAdoptedAnima]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setIsBagOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    if (!isQuestOpen) {
      return;
    }
    void loadQuests();
  }, [isQuestOpen, loadQuests]);

  useEffect(() => {
    if (!isEvolutionOpen) {
      return;
    }
    void loadPrimaryAdoptedAnima();
  }, [isEvolutionOpen, loadPrimaryAdoptedAnima]);

  useEffect(() => {
    if (!dragState.active) return;

    const handleMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragState.pointerX;
      const deltaY = event.clientY - dragState.pointerY;
      setWindowOffset({
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      });
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

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragState({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: windowOffset.x,
      originY: windowOffset.y,
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

  const handleEvolveAnima = useCallback(async () => {
    if (!primaryAdoptedAnima || !canEvolve || !primaryAdoptedAnima.baseAnima.nextEvolution) {
      return;
    }
    const previous = primaryAdoptedAnima;
    setEvolutionSubmitting(true);
    try {
      const updated = await evolveAdoptedAnima(primaryAdoptedAnima.id);
      setPrimaryAdoptedAnima(updated);
      await syncEvolutionChain(updated);
      setEvolutionErrorMessage(null);
      setStatusMessage(`${previous.nickname} evoluiu para ${updated.baseAnima.name}.`);
      setIsEvolutionOpen(false);
      window.dispatchEvent(
        new CustomEvent("explore:anima-evolved", {
          detail: {
            action: "evolved",
            from: previous,
            to: updated,
          },
        }),
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setEvolutionErrorMessage(error.message);
      } else {
        setEvolutionErrorMessage("Falha ao evoluir anima.");
      }
    } finally {
      setEvolutionSubmitting(false);
    }
  }, [canEvolve, primaryAdoptedAnima, syncEvolutionChain]);

  const handleRegressAnima = useCallback(async () => {
    if (!primaryAdoptedAnima || !canRegress) {
      return;
    }
    const previous = primaryAdoptedAnima;
    setEvolutionSubmitting(true);
    try {
      const updated = await regressAdoptedAnima(primaryAdoptedAnima.id);
      setPrimaryAdoptedAnima(updated);
      await syncEvolutionChain(updated);
      setEvolutionErrorMessage(null);
      setStatusMessage(`${previous.nickname} regrediu para ${updated.baseAnima.name}.`);
      setIsEvolutionOpen(false);
      window.dispatchEvent(
        new CustomEvent("explore:anima-evolved", {
          detail: {
            action: "regressed",
            from: previous,
            to: updated,
          },
        }),
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setEvolutionErrorMessage(error.message);
      } else {
        setEvolutionErrorMessage("Falha ao regredir anima.");
      }
    } finally {
      setEvolutionSubmitting(false);
    }
  }, [canRegress, primaryAdoptedAnima, syncEvolutionChain]);

  const triggerEvolutionHotbarSlot = useCallback(
    async (slotIndex: number) => {
      if (!primaryAdoptedAnima || !evolutionChain || evolutionSubmitting) {
        return;
      }
      const selected = unlockedEvolutionNodes[slotIndex];
      if (!selected) {
        return;
      }

      const currentIndex = evolutionChain.currentIndex;
      const clickedIndex = evolutionChain.chain.findIndex((node) => node.id === selected.id);
      if (clickedIndex < 0 || clickedIndex === currentIndex) {
        return;
      }
      const delta = clickedIndex - currentIndex;
      if (Math.abs(delta) !== 1) {
        setStatusMessage("Nao e possivel pular evolucoes.");
        return;
      }
      if (delta < 0) {
        await handleRegressAnima();
        return;
      }
      if (!canEvolve) {
        setStatusMessage(`Nivel insuficiente para evoluir. Necessario nivel ${primaryAdoptedAnima.baseAnima.nextEvolutionLevelRequired}.`);
        return;
      }
      await handleEvolveAnima();
    },
    [canEvolve, evolutionChain, evolutionSubmitting, handleEvolveAnima, handleRegressAnima, primaryAdoptedAnima, unlockedEvolutionNodes],
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
              variant={isQuestOpen ? "default" : "outline"}
              className="mx-auto h-10 w-10 rounded-lg border-slate-300/20 bg-slate-900/55 text-slate-100 hover:bg-slate-900/75"
              onClick={() => setIsQuestOpen((current) => !current)}
              aria-label="Abrir lista de quests"
            >
              <ClipboardList className="h-5 w-5" />
            </Button>
            <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Quests</p>
          </div>
          <div className="flex min-w-[72px] flex-col items-center justify-center">
            <Button
              type="button"
              size="icon"
              variant={isEvolutionOpen ? "default" : "outline"}
              className="mx-auto h-10 w-10 rounded-lg border-slate-300/20 bg-slate-900/55 text-slate-100 hover:bg-slate-900/75"
              onClick={() => setIsEvolutionOpen((current) => !current)}
              aria-label="Abrir painel de evolucoes"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Evolucoes</p>
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
              const isClickable = (delta === -1 && canRegress) || (delta === 1 && canEvolve);
              const disabled = evolutionSubmitting || !isClickable;
              const hint = isCurrent ? `${node.name} (Atual)` : delta === -1 ? `Regredir para ${node.name}` : delta === 1 ? `Evoluir para ${node.name}` : `${node.name} (nao pode pular)`;

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
              onPointerDown={handleHeaderPointerDown}
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
                        setUseDialogItem(visibleItem);
                        setUseDialogQuantity("1");
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

      <Dialog open={isQuestOpen} onOpenChange={setIsQuestOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quests</DialogTitle>
            <DialogDescription className="text-slate-300">Lista completa das quests ativas e finalizadas.</DialogDescription>
          </DialogHeader>

          {questErrorMessage ? <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{questErrorMessage}</p> : null}
          {questLoading ? <p className="text-sm text-muted-foreground">Carregando quests...</p> : null}

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Ativas ({activeQuests.length}/3)</p>
              <div className="max-h-[32vh] space-y-2 overflow-y-auto pr-1">
                {activeQuests.length === 0 ? <p className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-xs text-slate-400">Sem quests ativas.</p> : null}
                {activeQuests.map((quest) => (
                  <div key={quest.id} className="rounded-md border border-slate-200/20 bg-slate-900/45 p-3">
                    <p className="text-sm font-medium">{quest.title}</p>
                    <p className="text-xs text-slate-300">{quest.description}</p>
                    <div className="mt-2 space-y-1">
                      {quest.objectives.map((objective) => (
                        <p key={objective.id} className="text-xs text-slate-200">
                          {objective.type === "TALK"
                            ? `Falar com ${objective.npcName ?? objective.npcId}: ${objective.current}/${objective.required}`
                            : objective.type === "KILL"
                              ? `Matar ${objective.bestiaryName ?? objective.bestiaryAnimaId}: ${objective.current}/${objective.required}`
                              : `Dropar ${objective.itemName ?? objective.itemId}: ${objective.current}/${objective.required}`}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Concluidas</p>
              <div className="max-h-[24vh] space-y-2 overflow-y-auto pr-1">
                {completedQuests.length === 0 ? <p className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-xs text-slate-400">Nenhuma quest concluida.</p> : null}
                {completedQuests.map((quest) => (
                  <div key={quest.id} className="rounded-md border border-slate-200/20 bg-slate-900/45 p-3">
                    <p className="text-sm font-medium">{quest.title}</p>
                    <p className="text-xs text-slate-300">{quest.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEvolutionOpen} onOpenChange={setIsEvolutionOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Evolucoes</DialogTitle>
            <DialogDescription className="text-slate-300">Desbloqueie e evolua seu anima principal.</DialogDescription>
          </DialogHeader>

          {evolutionErrorMessage ? <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{evolutionErrorMessage}</p> : null}
          {evolutionLoading ? <p className="text-sm text-muted-foreground">Carregando evolucoes...</p> : null}

          {primaryAdoptedAnima ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200/15 bg-slate-950/40 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{primaryAdoptedAnima.nickname}</p>
                  <p className="text-xs text-slate-400">Especie atual: {primaryAdoptedAnima.baseAnima.name}</p>
                </div>
                <div className="rounded-md border border-slate-200/20 bg-slate-900/55 px-2 py-1 text-xs text-slate-200">
                  Nivel {primaryAdoptedAnima.level}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200/15 bg-slate-950/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Regredir</p>
                  <button
                    type="button"
                    disabled={!canRegress || evolutionSubmitting}
                    className={cn(
                      "group relative w-full overflow-hidden rounded-lg border border-slate-300/20 bg-slate-950/55 p-4 text-left transition",
                      canRegress ? "hover:border-amber-300/55 hover:bg-slate-900/65" : "cursor-not-allowed opacity-75",
                    )}
                    onClick={() => void handleRegressAnima()}
                  >
                    <div className="flex items-center gap-3">
                      {primaryAdoptedAnima.baseAnima.previousEvolution?.imageData ? (
                        <img
                          src={primaryAdoptedAnima.baseAnima.previousEvolution.imageData}
                          alt={primaryAdoptedAnima.baseAnima.previousEvolution.name}
                          className="h-14 w-14 object-contain"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md border border-slate-300/20 bg-slate-900/50" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{primaryAdoptedAnima.baseAnima.previousEvolution?.name ?? "Sem regressao"}</p>
                        <p className="text-xs text-slate-400">
                          {canRegress ? "Clique para voltar para a evolucao anterior." : "Nao ha evolucao anterior."}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200/15 bg-slate-950/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Proxima evolucao</p>
                  {primaryAdoptedAnima.baseAnima.nextEvolution ? (
                    <>
                      <button
                        type="button"
                        disabled={!canEvolve || evolutionSubmitting}
                        className={cn(
                          "group relative w-full overflow-hidden rounded-lg border border-slate-300/20 bg-slate-950/55 p-4 text-left transition",
                          canEvolve ? "hover:border-sky-300/55 hover:bg-slate-900/65" : "cursor-not-allowed opacity-75",
                        )}
                        onClick={() => void handleEvolveAnima()}
                      >
                        <div className="flex items-center gap-3">
                          {primaryAdoptedAnima.baseAnima.nextEvolution.imageData ? (
                            <img
                              src={primaryAdoptedAnima.baseAnima.nextEvolution.imageData}
                              alt={primaryAdoptedAnima.baseAnima.nextEvolution.name}
                              className="h-14 w-14 object-contain"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-md border border-slate-300/20 bg-slate-900/50" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{primaryAdoptedAnima.baseAnima.nextEvolution.name}</p>
                            <p className="text-xs text-slate-400">
                              {canEvolve ? "Clique para evoluir agora." : "Nivel insuficiente para evoluir."}
                            </p>
                          </div>
                        </div>
                      </button>

                      <p className="text-xs text-slate-300">
                        Requisito: nivel {primaryAdoptedAnima.baseAnima.nextEvolutionLevelRequired}
                      </p>
                    </>
                  ) : (
                    <p className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-xs text-slate-400">
                      Este anima nao possui proxima evolucao.
                    </p>
                  )}
                </div>
              </div>

              {primaryAdoptedAnima.baseAnima.nextEvolution ? (
                <div className="flex flex-wrap items-center gap-2">
                  {canEvolve ? (
                    <p className="text-xs text-emerald-300">Evolucao disponivel automaticamente pelo nivel.</p>
                  ) : (
                    <p className="text-xs text-amber-300">
                      Nivel insuficiente. Necessario nivel {primaryAdoptedAnima.baseAnima.nextEvolutionLevelRequired}.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : !evolutionLoading ? (
            <p className="rounded-md border border-slate-200/20 bg-slate-900/45 px-3 py-2 text-xs text-slate-400">Nenhum anima principal encontrado.</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(useDialogItem)}
        onOpenChange={(open) => {
          if (!open) {
            setUseDialogItem(null);
            setUseDialogQuantity("1");
            setUseDialogSubmitting(false);
          }
        }}
      >
        <DialogContent className="max-h-[70vh] overflow-y-auto rounded-2xl border-slate-200/20 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-950/96 text-slate-100 backdrop-blur-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Usar item</DialogTitle>
            <DialogDescription className="text-slate-300">
              {useDialogItem ? `${useDialogItem.item.name} (x${useDialogItem.quantity})` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs text-slate-200">
            <label className="flex flex-col gap-1">
              <span>Quantidade para usar</span>
              <input
                type="number"
                min={1}
                max={useDialogItem?.quantity ?? 1}
                value={useDialogQuantity}
                onChange={(event) => setUseDialogQuantity(event.target.value)}
                className="h-8 rounded-md border border-slate-700 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none focus:border-slate-300"
              />
              {useDialogItem ? (
                <span className="text-[10px] text-slate-400">
                  Disponivel: {useDialogItem.quantity.toLocaleString("pt-BR")}
                </span>
              ) : null}
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200/20 bg-slate-900/45 text-slate-200 hover:bg-slate-900/62"
              disabled={useDialogSubmitting}
              onClick={() => {
                setUseDialogItem(null);
                setUseDialogQuantity("1");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={useDialogSubmitting || !useDialogItem}
              onClick={async () => {
                if (!useDialogItem) return;
                const value = Number(useDialogQuantity) || 0;
                if (value <= 0) return;
                setUseDialogSubmitting(true);
                await handleUseItem(useDialogItem, value);
                setUseDialogSubmitting(false);
                setUseDialogItem(null);
                setUseDialogQuantity("1");
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
