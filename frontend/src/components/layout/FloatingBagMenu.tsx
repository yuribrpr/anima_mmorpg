import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Backpack, Coins, Gem, Lock, Sparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { getUserInventory, updateInventoryLayout, useInventoryItem } from "@/lib/inventario";
import { cn } from "@/lib/utils";
import type { InventoryItem, InventoryItemLayout, UserInventory } from "@/types/inventario";
import { Button } from "@/components/ui/button";

type BagCategory = "all" | "consumable" | "quest" | "normal";

type FloatingBagMenuProps = {
  embedded?: boolean;
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

const defaultInventory: UserInventory = {
  bits: 0,
  crystals: 0,
  totalSlots: 56,
  lockedSlotStart: 40,
  layout: [],
  items: [],
  updatedAt: new Date().toISOString(),
};

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

export const FloatingBagMenu = ({ embedded = false }: FloatingBagMenuProps) => {
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

  const canDragSlots = activeTab === "all" && !isSavingLayout && !isUsingItem;
  const selectedBagItem = useMemo(() => slotItems[selectedSlot] ?? null, [selectedSlot, slotItems]);

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

  const loadInventory = useCallback(async () => {
    try {
      const nextInventory = await getUserInventory();
      setInventory(nextInventory);
      setSlotItems(buildSlotsFromInventory(nextInventory));
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

  const handleUseSelectedItem = async () => {
    if (!selectedBagItem || selectedBagItem.item.type !== "CONSUMIVEL") {
      return;
    }

    setIsUsingItem(true);
    try {
      const result = await useInventoryItem(selectedBagItem.itemId, 1);
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
    } catch (error) {
      if (error instanceof ApiError) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Falha ao usar item.");
      }
    } finally {
      setIsUsingItem(false);
    }
  };

  return (
    <>
      <div className={cn(embedded ? "absolute bottom-4 right-4 z-30" : "fixed bottom-5 right-5 z-50")}>
        <div className="w-[78px] rounded-xl border border-border bg-card/90 p-2 shadow-lg backdrop-blur">
          <Button
            type="button"
            size="icon"
            variant={isBagOpen ? "default" : "outline"}
            className="mx-auto h-10 w-10 rounded-lg"
            onClick={() => setIsBagOpen((current) => !current)}
            aria-label="Abrir inventario de itens"
          >
            <Backpack className="h-5 w-5" />
          </Button>
          <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">Inventario</p>
        </div>
      </div>

      {isBagOpen ? (
        <div
          className={cn(embedded ? "absolute bottom-20 right-4 z-30" : "fixed bottom-24 right-5 z-50")}
          style={{ transform: `translate3d(${windowOffset.x}px, ${windowOffset.y}px, 0)` }}
        >
          <div className="w-[540px] max-w-[min(94vw,540px)] overflow-hidden rounded-xl border border-border bg-slate-950/95 shadow-2xl backdrop-blur">
            <div
              className="flex cursor-move items-center justify-between border-b border-slate-700/70 bg-slate-900/90 px-3 py-2"
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

            <div className="border-b border-slate-700/70 bg-slate-900/70 px-2 py-1.5">
              <div className="flex flex-wrap gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "rounded border px-2 py-1 text-[11px] leading-none transition-colors",
                      activeTab === tab.key
                        ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                        : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/95 p-2">
              <div className="grid grid-cols-8 gap-1 rounded-md border border-slate-700/70 bg-slate-900/50 p-1.5">
                {Array.from({ length: inventory.totalSlots }, (_, index) => {
                  const visibleItem = visibleSlots[index] ?? null;
                  const rawItem = slotItems[index] ?? null;
                  const isLocked = index >= inventory.lockedSlotStart;
                  const isSelected = selectedSlot === index && !isLocked;
                  const draggable = canDragSlots && !isLocked && Boolean(rawItem);

                  return (
                    <button
                      key={`bag-slot-${index}`}
                      type="button"
                      disabled={isLocked}
                      draggable={draggable}
                      className={cn(
                        "relative aspect-square rounded-[4px] border text-[10px] transition-colors",
                        isLocked ? "cursor-not-allowed border-slate-800 bg-slate-900/80 text-slate-700" : "border-slate-700 bg-slate-900/80 hover:border-slate-500",
                        isSelected ? "border-sky-400 bg-sky-500/20" : undefined,
                        visibleItem ? rarityByType[visibleItem.item.type] : undefined,
                      )}
                      onClick={() => {
                        if (!isLocked) setSelectedSlot(index);
                      }}
                      onDragStart={(event) => {
                        if (!draggable) return;
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
                        </>
                      ) : (
                        <span className="text-slate-700">-</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-700/70 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">
              <div className="min-w-0">
                {selectedBagItem ? (
                  <>
                    <p className="truncate">
                      <strong>{selectedBagItem.item.name}</strong> . x{selectedBagItem.quantity} . {selectedBagItem.item.description}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      HP {selectedBagItem.item.healPercentMaxHp}% | ATK +{selectedBagItem.item.bonusAttack} | DEF +{selectedBagItem.item.bonusDefense} | HPMax +{selectedBagItem.item.bonusMaxHp}
                    </p>
                  </>
                ) : (
                  <p className="truncate text-slate-400">Selecione um slot para ver os detalhes.</p>
                )}
                <p className="truncate text-[10px] text-slate-400">
                  {isSavingLayout
                    ? "Salvando layout..."
                    : statusMessage ?? (activeTab === "all" ? "Arraste e solte para reorganizar." : "Troque para aba All para arrastar itens.")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {selectedBagItem?.item.type === "CONSUMIVEL" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[11px]"
                    disabled={isUsingItem}
                    onClick={() => void handleUseSelectedItem()}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isUsingItem ? "..." : "Usar"}
                  </Button>
                ) : null}
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Coins className="h-3.5 w-3.5" />
                  {inventory.bits.toLocaleString("pt-BR")}
                </span>
                <span className="inline-flex items-center gap-1 text-cyan-300">
                  <Gem className="h-3.5 w-3.5" />
                  {inventory.crystals.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
