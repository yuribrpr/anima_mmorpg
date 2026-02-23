import { useEffect, useMemo, useState } from "react";
import { Backpack, Coins, Crown, Gem, HeartPulse, Search, Shield, Sparkles, Swords, Timer } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listAdoptedAnimas, setPrimaryAdoptedAnima } from "@/lib/adocoes";
import { cn } from "@/lib/utils";
import type { AdoptedAnima } from "@/types/adocao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimaStatsRadar, type RadarMetric } from "@/components/common/AnimaStatsRadar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type SortKey = "recent" | "level" | "power";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "level", label: "Maior nivel" },
  { value: "power", label: "Maior poder" },
];

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatSeconds = (value: number) => `${value.toFixed(2)}s`;
const toSpeedScore = (seconds: number) => 1 / Math.max(seconds, 0.05);

type BagItem = {
  id: string;
  name: string;
  icon: string;
  category: string;
  quantity: number;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  value: number;
};

const bagTemplateItems: BagItem[] = [
  { id: "pocao-vida", name: "Pocao de Vida", icon: "HP", category: "Consumivel", quantity: 24, description: "Recupera 120 de vida.", rarity: "common", value: 18 },
  { id: "pocao-energia", name: "Pocao de Energia", icon: "MP", category: "Consumivel", quantity: 14, description: "Acelera regeneracao por 10s.", rarity: "rare", value: 36 },
  { id: "chip-ataque", name: "Chip de Ataque", icon: "AT", category: "Upgrade", quantity: 3, description: "Aumenta ATK base em +5.", rarity: "epic", value: 220 },
  { id: "chip-defesa", name: "Chip de Defesa", icon: "DF", category: "Upgrade", quantity: 5, description: "Aumenta DEF base em +5.", rarity: "rare", value: 185 },
  { id: "modulo-critico", name: "Modulo Critico", icon: "CR", category: "Upgrade", quantity: 2, description: "Aumenta chance critica.", rarity: "epic", value: 290 },
  { id: "nucleo-radiante", name: "Nucleo Radiante", icon: "NR", category: "Essencia", quantity: 1, description: "Material raro de evolucao.", rarity: "legendary", value: 920 },
  { id: "fio-porta", name: "Fio de Portal", icon: "PT", category: "Craft", quantity: 9, description: "Usado em dispositivos de portal.", rarity: "rare", value: 95 },
  { id: "placa-antiga", name: "Placa Antiga", icon: "PL", category: "Relic", quantity: 4, description: "Fragmento de tecnologia ancestral.", rarity: "epic", value: 410 },
  { id: "selo-fogo", name: "Selo de Fogo", icon: "FG", category: "Essencia", quantity: 6, description: "Catalisador elemental.", rarity: "rare", value: 130 },
  { id: "selo-vento", name: "Selo de Vento", icon: "VN", category: "Essencia", quantity: 8, description: "Catalisador de agilidade.", rarity: "common", value: 72 },
  { id: "mapa-ruinas", name: "Mapa das Ruinas", icon: "MP", category: "Quest", quantity: 1, description: "Indica um setor secreto.", rarity: "legendary", value: 760 },
  { id: "chave-arca", name: "Chave da Arca", icon: "KY", category: "Quest", quantity: 1, description: "Abre baus trancados antigos.", rarity: "epic", value: 580 },
];

const raritySlotClass: Record<BagItem["rarity"], string> = {
  common: "border-border bg-muted/30 text-foreground",
  rare: "border-sky-500/60 bg-sky-500/10 text-sky-100",
  epic: "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-100",
  legendary: "border-amber-500/60 bg-amber-500/10 text-amber-100",
};

const formatShortDate = (date: string) => {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const estimatePowerScore = (anima: AdoptedAnima) => anima.totalAttack + anima.totalDefense + anima.totalMaxHp * 0.2;

const Meter = ({
  label,
  value,
  max,
  toneClass,
}: {
  label: string;
  value: number;
  max: number;
  toneClass: string;
}) => {
  const safeMax = Math.max(max, 1);
  const percent = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>{label}</p>
        <p>
          {value}/{max}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", toneClass)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export const InventarioPage = () => {
  const [animas, setAnimas] = useState<AdoptedAnima[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingPrimaryId, setUpdatingPrimaryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("power");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [selectedBagSlot, setSelectedBagSlot] = useState(0);

  const bagSlots = useMemo<(BagItem | null)[]>(() => {
    const slots = Array.from({ length: 56 }, () => null as BagItem | null);
    bagTemplateItems.forEach((item, index) => {
      if (index < slots.length) {
        slots[index] = item;
      }
    });
    return slots;
  }, []);

  const firstFilledBagSlot = useMemo(() => bagSlots.findIndex((slot) => slot !== null), [bagSlots]);
  const selectedBagItem = useMemo(() => bagSlots[selectedBagSlot] ?? null, [bagSlots, selectedBagSlot]);

  const primary = useMemo(() => animas.find((item) => item.isPrimary) ?? null, [animas]);

  const filteredAnimas = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearch = query
      ? animas.filter(
          (anima) => anima.nickname.toLowerCase().includes(query) || anima.baseAnima.name.toLowerCase().includes(query),
        )
      : animas;

    return [...bySearch].sort((left, right) => {
      if (sort === "recent") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      if (sort === "level") {
        return right.level - left.level;
      }
      return estimatePowerScore(right) - estimatePowerScore(left);
    });
  }, [animas, search, sort]);

  const selected = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return animas.find((item) => item.id === selectedId) ?? null;
  }, [animas, selectedId]);

  const averageLevel = useMemo(() => {
    if (animas.length === 0) {
      return "0.0";
    }
    const total = animas.reduce((acc, item) => acc + item.level, 0);
    return (total / animas.length).toFixed(1);
  }, [animas]);

  const radarMaxima = useMemo(() => {
    return {
      attack: Math.max(1, ...animas.map((item) => item.totalAttack)),
      defense: Math.max(1, ...animas.map((item) => item.totalDefense)),
      maxHp: Math.max(1, ...animas.map((item) => item.totalMaxHp)),
      crit: Math.max(1, ...animas.map((item) => item.totalCritChance)),
      agility: Math.max(1, ...animas.map((item) => item.baseAnima.agility)),
      speed: Math.max(1, ...animas.map((item) => toSpeedScore(item.totalAttackSpeedSeconds))),
    };
  }, [animas]);

  const selectedRadarMetrics = useMemo<RadarMetric[]>(() => {
    if (!selected) {
      return [];
    }

    return [
      { key: "attack", label: "ATK", value: selected.totalAttack, max: radarMaxima.attack, displayValue: selected.totalAttack.toString() },
      { key: "defense", label: "DEF", value: selected.totalDefense, max: radarMaxima.defense, displayValue: selected.totalDefense.toString() },
      { key: "hp", label: "HP", value: selected.totalMaxHp, max: radarMaxima.maxHp, displayValue: selected.totalMaxHp.toString() },
      {
        key: "speed",
        label: "SPD",
        value: toSpeedScore(selected.totalAttackSpeedSeconds),
        max: radarMaxima.speed,
        displayValue: formatSeconds(selected.totalAttackSpeedSeconds),
      },
      {
        key: "crit",
        label: "CRT",
        value: selected.totalCritChance,
        max: radarMaxima.crit,
        displayValue: formatPercent(selected.totalCritChance),
      },
      { key: "agility", label: "AGI", value: selected.baseAnima.agility, max: radarMaxima.agility, displayValue: selected.baseAnima.agility.toString() },
    ];
  }, [radarMaxima, selected]);

  const bagWallet = useMemo(() => {
    const levelPoints = animas.reduce((acc, anima) => acc + anima.level * 18, 0);
    const powerPoints = animas.reduce((acc, anima) => acc + Math.round(estimatePowerScore(anima) / 35), 0);
    const bits = 1_650 + levelPoints + powerPoints;
    const crystals = Math.max(12, Math.round(bits / 90));
    return { bits, crystals };
  }, [animas]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await listAdoptedAnimas();
      setAnimas(data);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel carregar seu inventario.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInventory();
  }, []);

  useEffect(() => {
    if (animas.length === 0) {
      setSelectedId(null);
      return;
    }

    if (selectedId && animas.some((item) => item.id === selectedId)) {
      return;
    }

    setSelectedId((primary ?? animas[0]).id);
  }, [animas, primary, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return;
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setIsBagOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isBagOpen) {
      return;
    }

    setSelectedBagSlot((current) => {
      if (bagSlots[current]) {
        return current;
      }
      return firstFilledBagSlot >= 0 ? firstFilledBagSlot : 0;
    });
  }, [bagSlots, firstFilledBagSlot, isBagOpen]);

  const handleSetPrimary = async (id: string) => {
    setUpdatingPrimaryId(id);
    try {
      await setPrimaryAdoptedAnima(id);
      await fetchInventory();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel definir o anima principal.");
      }
    } finally {
      setUpdatingPrimaryId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Inventario de Animas</p>
          <h1 className="text-3xl font-semibold tracking-tight">Seus companheiros</h1>
          <p className="text-sm text-muted-foreground">Visualizacao rapida dos stats e acao direta para trocar o principal.</p>
        </div>
        <Button variant="outline" onClick={() => void fetchInventory()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar inventario"}
        </Button>
      </header>

      {errorMessage ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errorMessage}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{animas.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Media de nivel</CardDescription>
            <CardTitle className="text-2xl">{averageLevel}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Anima principal</CardDescription>
            <CardTitle className="truncate text-xl">{primary?.nickname ?? "Nao definido"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Colecao</CardTitle>
                <CardDescription>Selecione um Anima para ver detalhes.</CardDescription>
              </div>
              <Badge variant="secondary">{filteredAnimas.length} visiveis</Badge>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por apelido ou especie..." className="pl-9" />
            </div>

            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={sort === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSort(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
                ))}
              </div>
            ) : null}

            {!loading && filteredAnimas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum Anima encontrado com esse filtro.</p>
              </div>
            ) : null}

            {!loading
              ? filteredAnimas.map((anima) => (
                  <button
                    key={anima.id}
                    type="button"
                    onClick={() => setSelectedId(anima.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      anima.id === selectedId ? "border-primary/70 bg-muted/60" : "border-border bg-card/40 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {anima.baseAnima.imageData ? (
                        <img
                          src={anima.baseAnima.imageData}
                          alt={anima.baseAnima.name}
                          className="h-14 w-14 rounded-md border border-border bg-muted/20 p-1 object-contain"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md border border-border bg-muted/40" />
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{anima.nickname}</p>
                            <p className="truncate text-xs text-muted-foreground">{anima.baseAnima.name}</p>
                          </div>
                          {anima.isPrimary ? (
                            <Badge>
                              <Crown className="mr-1 h-3 w-3" />
                              Principal
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Reserva</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md border border-border bg-muted/30 px-2 py-1">Nivel {anima.level}</div>
                          <div className="rounded-md border border-border bg-muted/30 px-2 py-1">ATK {anima.totalAttack}</div>
                          <div className="rounded-md border border-border bg-muted/30 px-2 py-1">DEF {anima.totalDefense}</div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              : null}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-4rem)] xl:overflow-auto">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Detalhes</CardTitle>
            <CardDescription>Painel completo do Anima selecionado.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Selecione um Anima na lista para visualizar os dados.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{selected.nickname}</p>
                    <p className="text-sm text-muted-foreground">
                      {selected.baseAnima.name} . {selected.baseAnima.powerLevel}
                    </p>
                  </div>
                  {selected.isPrimary ? (
                    <Badge>
                      <Crown className="mr-1 h-3 w-3" />
                      Principal
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Reserva</Badge>
                  )}
                </div>

                {selected.baseAnima.imageData ? (
                  <div className="flex h-52 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20 p-2">
                    <img src={selected.baseAnima.imageData} alt={selected.baseAnima.name} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-52 w-full rounded-lg border border-border bg-muted/40" />
                )}

                {selectedRadarMetrics.length > 0 ? <AnimaStatsRadar metrics={selectedRadarMetrics} title="Radar de combate" /> : null}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Adotado em</p>
                    <p className="mt-1 text-sm font-medium">{formatShortDate(selected.createdAt)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Score de poder</p>
                    <p className="mt-1 text-sm font-medium">{Math.round(estimatePowerScore(selected))}</p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <Meter label="Vida atual" value={selected.currentHp} max={selected.totalMaxHp} toneClass="bg-emerald-500" />
                  <Meter label="Experiencia" value={selected.experience} max={selected.experienceMax} toneClass="bg-primary" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Swords className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Ataque final: <strong>{selected.totalAttack}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Shield className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Defesa final: <strong>{selected.totalDefense}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Timer className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Velocidade final: <strong>{formatSeconds(selected.totalAttackSpeedSeconds)}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Sparkles className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Critico final: <strong>{formatPercent(selected.totalCritChance)}</strong>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[1.1fr_repeat(3,minmax(0,1fr))] gap-px bg-border text-xs">
                    <div className="bg-card px-3 py-2 text-muted-foreground">Atributo</div>
                    <div className="bg-card px-3 py-2 text-muted-foreground">Base</div>
                    <div className="bg-card px-3 py-2 text-muted-foreground">Bonus</div>
                    <div className="bg-card px-3 py-2 text-muted-foreground">Total</div>

                    <div className="bg-card px-3 py-2">Ataque</div>
                    <div className="bg-card px-3 py-2">{selected.baseAnima.attack}</div>
                    <div className="bg-card px-3 py-2 text-emerald-400">+{selected.bonusAttack}</div>
                    <div className="bg-card px-3 py-2 font-medium">{selected.totalAttack}</div>

                    <div className="bg-card px-3 py-2">Defesa</div>
                    <div className="bg-card px-3 py-2">{selected.baseAnima.defense}</div>
                    <div className="bg-card px-3 py-2 text-emerald-400">+{selected.bonusDefense}</div>
                    <div className="bg-card px-3 py-2 font-medium">{selected.totalDefense}</div>

                    <div className="bg-card px-3 py-2">Vida maxima</div>
                    <div className="bg-card px-3 py-2">{selected.baseAnima.maxHp}</div>
                    <div className="bg-card px-3 py-2 text-emerald-400">+{selected.bonusMaxHp}</div>
                    <div className="bg-card px-3 py-2 font-medium">{selected.totalMaxHp}</div>

                    <div className="bg-card px-3 py-2">Velocidade</div>
                    <div className="bg-card px-3 py-2">{formatSeconds(selected.baseAnima.attackSpeedSeconds)}</div>
                    <div className="bg-card px-3 py-2 text-emerald-400">-{formatSeconds(selected.attackSpeedReduction)}</div>
                    <div className="bg-card px-3 py-2 font-medium">{formatSeconds(selected.totalAttackSpeedSeconds)}</div>

                    <div className="bg-card px-3 py-2">Critico</div>
                    <div className="bg-card px-3 py-2">{formatPercent(selected.baseAnima.critChance)}</div>
                    <div className="bg-card px-3 py-2 text-emerald-400">+{formatPercent(selected.critChanceBonus)}</div>
                    <div className="bg-card px-3 py-2 font-medium">{formatPercent(selected.totalCritChance)}</div>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  variant={selected.isPrimary ? "outline" : "default"}
                  onClick={() => void handleSetPrimary(selected.id)}
                  disabled={selected.isPrimary || updatingPrimaryId === selected.id}
                >
                  {selected.isPrimary ? (
                    <>
                      <HeartPulse className="h-4 w-4" />
                      Anima principal ativo
                    </>
                  ) : updatingPrimaryId === selected.id ? (
                    "Aplicando..."
                  ) : (
                    <>
                      <Crown className="h-4 w-4" />
                      Definir como principal
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-5 right-5 z-40">
        <div className="rounded-2xl border border-border bg-card/90 p-2 shadow-lg backdrop-blur">
          <Button
            type="button"
            size="icon"
            variant={isBagOpen ? "default" : "outline"}
            className="h-11 w-11 rounded-xl"
            onClick={() => setIsBagOpen((current) => !current)}
            aria-label="Abrir inventario de itens"
          >
            <Backpack className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-1 text-right text-[11px] text-muted-foreground">Inventario (I)</p>
      </div>

      <Dialog open={isBagOpen} onOpenChange={setIsBagOpen}>
        <DialogContent className="max-w-[min(96vw,980px)] overflow-hidden border-border bg-card p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-lg">Bag</DialogTitle>
            <DialogDescription>Itens de uso rapido, materiais e saldo atual.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-0 md:grid-cols-[1fr_290px]">
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Slots</p>
                <p className="text-xs text-muted-foreground">
                  {bagSlots.filter(Boolean).length}/{bagSlots.length} ocupados
                </p>
              </div>

              <div className="grid grid-cols-8 gap-1.5 rounded-lg border border-border bg-muted/20 p-2">
                {bagSlots.map((item, index) => (
                  <button
                    key={`bag-slot-${index}`}
                    type="button"
                    className={cn(
                      "relative aspect-square rounded-md border text-[10px] transition-colors",
                      selectedBagSlot === index ? "border-primary bg-primary/15" : "border-border bg-card/40 hover:bg-muted/40",
                      item ? raritySlotClass[item.rarity] : undefined,
                    )}
                    onClick={() => setSelectedBagSlot(index)}
                  >
                    {item ? (
                      <>
                        <span className="flex h-full items-center justify-center text-[11px] font-semibold">{item.icon}</span>
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-[1px] text-[9px] leading-none text-white">
                          {item.quantity}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/45">-</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <aside className="space-y-3 border-t border-border bg-muted/20 p-4 md:border-l md:border-t-0">
              <div className="rounded-lg border border-border bg-card/70 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Dinheiro</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Coins className="h-4 w-4 text-amber-400" />
                      Bits
                    </span>
                    <strong>{bagWallet.bits.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Gem className="h-4 w-4 text-cyan-400" />
                      Cristais
                    </span>
                    <strong>{bagWallet.crystals.toLocaleString("pt-BR")}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card/70 p-3">
                {selectedBagItem ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-md border text-sm font-semibold",
                          raritySlotClass[selectedBagItem.rarity],
                        )}
                      >
                        {selectedBagItem.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{selectedBagItem.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedBagItem.category}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedBagItem.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
                        Qtd: <strong>{selectedBagItem.quantity}</strong>
                      </div>
                      <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
                        Valor: <strong>{selectedBagItem.value}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Selecione um slot com item para ver os detalhes.</p>
                )}
              </div>
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
