import { useEffect, useMemo, useState } from "react";
import { Crown, Shield, Sparkles, Sword, Timer } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listAdoptedAnimas, setPrimaryAdoptedAnima } from "@/lib/adocoes";
import type { AdoptedAnima } from "@/types/adocao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatSeconds = (value: number) => `${value.toFixed(2)}s`;

const ProgressBar = ({ value, max, colorClass }: { value: number; max: number; colorClass: string }) => {
  const percent = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${percent}%` }} />
    </div>
  );
};

const StatRow = ({ label, base, bonus, total }: { label: string; base: string | number; bonus: string | number; total: string | number }) => (
  <div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/30 p-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span>{base}</span>
    <span className="text-emerald-600">+{bonus}</span>
    <span className="font-semibold">{total}</span>
  </div>
);

export const InventarioPage = () => {
  const [animas, setAnimas] = useState<AdoptedAnima[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdoptedAnima | null>(null);
  const [updatingPrimaryId, setUpdatingPrimaryId] = useState<string | null>(null);

  const primary = useMemo(() => animas.find((item) => item.isPrimary) ?? null, [animas]);

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
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inventario de Animas</p>
            {primary ? (
              <Badge variant="secondary">
                <Crown className="mr-1 h-3.5 w-3.5" />
                Principal: {primary.nickname}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-3xl tracking-tight">Seus Animas adotados</CardTitle>
          <CardDescription>Abra os detalhes para ver base da biblioteca, bonus e atributos finais de batalha.</CardDescription>
        </CardHeader>
      </Card>

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!loading && animas.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle>Nenhum anima adotado</CardTitle>
              <CardDescription>Va para a tela de adocao para registrar seu primeiro companheiro.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {animas.map((anima) => (
          <Card key={anima.id} className="cursor-pointer transition-shadow hover:shadow-sm" onClick={() => setSelected(anima)}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{anima.nickname}</CardTitle>
                  <CardDescription>{anima.baseAnima.name}</CardDescription>
                </div>
                {anima.isPrimary ? <Badge>Principal</Badge> : <Badge variant="secondary">Reserva</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {anima.baseAnima.imageData ? (
                <img src={anima.baseAnima.imageData} alt={anima.baseAnima.name} className="h-40 w-full rounded-md border object-cover" />
              ) : (
                <div className="h-40 w-full rounded-md border bg-muted/30" />
              )}

              <div className="space-y-2 text-xs">
                <p>Nivel {anima.level}</p>
                <ProgressBar value={anima.experience} max={anima.experienceMax} colorClass="bg-primary" />
                <p className="text-muted-foreground">
                  EXP {anima.experience}/{anima.experienceMax}
                </p>
                <ProgressBar value={anima.currentHp} max={anima.totalMaxHp} colorClass="bg-emerald-500" />
                <p className="text-muted-foreground">
                  HP {anima.currentHp}/{anima.totalMaxHp}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border bg-muted/30 p-2">ATK {anima.totalAttack}</div>
                <div className="rounded-md border bg-muted/30 p-2">DEF {anima.totalDefense}</div>
              </div>

              {!anima.isPrimary ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleSetPrimary(anima.id);
                  }}
                  disabled={updatingPrimaryId === anima.id}
                >
                  {updatingPrimaryId === anima.id ? "Atualizando..." : "Definir como principal"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.nickname}</DialogTitle>
            <DialogDescription>Detalhes completos do Anima adotado e referencia da biblioteca.</DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                {selected.baseAnima.imageData ? (
                  <img src={selected.baseAnima.imageData} alt={selected.baseAnima.name} className="h-44 w-full rounded-md border object-cover" />
                ) : (
                  <div className="h-44 w-full rounded-md border bg-muted/30" />
                )}

                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {selected.baseAnima.name} ({selected.baseAnima.powerLevel})
                  </p>
                  <p className="mt-1 text-muted-foreground">Nivel {selected.level}</p>
                  <div className="mt-4 space-y-2">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Vida</p>
                      <ProgressBar value={selected.currentHp} max={selected.totalMaxHp} colorClass="bg-emerald-500" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.currentHp}/{selected.totalMaxHp}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Experiencia</p>
                      <ProgressBar value={selected.experience} max={selected.experienceMax} colorClass="bg-primary" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.experience}/{selected.experienceMax}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Atributos RPG</CardTitle>
                  <CardDescription>Base da biblioteca + bonus da adocao = total em combate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StatRow label="Ataque" base={selected.baseAnima.attack} bonus={selected.bonusAttack} total={selected.totalAttack} />
                  <StatRow label="Defesa" base={selected.baseAnima.defense} bonus={selected.bonusDefense} total={selected.totalDefense} />
                  <StatRow label="Vida Max" base={selected.baseAnima.maxHp} bonus={selected.bonusMaxHp} total={selected.totalMaxHp} />
                  <StatRow
                    label="Velocidade"
                    base={formatSeconds(selected.baseAnima.attackSpeedSeconds)}
                    bonus={formatSeconds(selected.attackSpeedReduction)}
                    total={formatSeconds(selected.totalAttackSpeedSeconds)}
                  />
                  <StatRow
                    label="Critico"
                    base={formatPercent(selected.baseAnima.critChance)}
                    bonus={formatPercent(selected.critChanceBonus)}
                    total={formatPercent(selected.totalCritChance)}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border bg-muted/30 p-3">
                  <Sword className="mb-2 h-4 w-4 text-muted-foreground" />
                  Ataque final: <strong>{selected.totalAttack}</strong>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <Shield className="mb-2 h-4 w-4 text-muted-foreground" />
                  Defesa final: <strong>{selected.totalDefense}</strong>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <Timer className="mb-2 h-4 w-4 text-muted-foreground" />
                  Velocidade final: <strong>{formatSeconds(selected.totalAttackSpeedSeconds)}</strong>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <Sparkles className="mb-2 h-4 w-4 text-muted-foreground" />
                  Critico final: <strong>{formatPercent(selected.totalCritChance)}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
};
