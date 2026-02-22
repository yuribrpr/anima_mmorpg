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
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${percent}%` }} />
    </div>
  );
};

const StatRow = ({ label, base, bonus, total }: { label: string; base: string | number; bonus: string | number; total: string | number }) => (
  <div className="grid grid-cols-4 gap-2 rounded border border-amber-600/20 bg-black/25 p-2 text-xs">
    <span className="text-amber-100/85">{label}</span>
    <span className="text-slate-300">{base}</span>
    <span className="text-emerald-300">+{bonus}</span>
    <span className="text-amber-200 font-semibold">{total}</span>
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
      <header className="rounded-xl border border-amber-700/35 bg-[radial-gradient(circle_at_30%_20%,_rgba(245,158,11,0.16),_rgba(2,6,23,0.95))] p-6 shadow-[0_0_48px_rgba(245,158,11,0.15)]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Inventario Arcano</p>
          {primary ? (
            <Badge className="bg-amber-500/25 text-amber-100 hover:bg-amber-500/25">
              <Crown className="mr-1 h-3.5 w-3.5" />
              Principal: {primary.nickname}
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-amber-50">Seus Animas adotados</h1>
        <p className="mt-2 text-sm text-amber-100/80">Abra os detalhes para ver base da biblioteca, bonus e atributos finais de batalha.</p>
      </header>

      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!loading && animas.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle>Nenhum anima adotado</CardTitle>
              <CardDescription>Vá para a tela de adocao para registrar seu primeiro companheiro.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {animas.map((anima) => (
          <Card
            key={anima.id}
            className="cursor-pointer border-amber-600/25 bg-[linear-gradient(145deg,rgba(120,53,15,0.25),rgba(15,23,42,0.92))] transition hover:border-amber-400/50"
            onClick={() => setSelected(anima)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-amber-50">{anima.nickname}</CardTitle>
                  <CardDescription className="text-amber-200/75">{anima.baseAnima.name}</CardDescription>
                </div>
                {anima.isPrimary ? (
                  <Badge className="bg-amber-500/25 text-amber-100 hover:bg-amber-500/25">Principal</Badge>
                ) : (
                  <Badge variant="secondary">Reserva</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {anima.baseAnima.imageData ? (
                <img src={anima.baseAnima.imageData} alt={anima.baseAnima.name} className="h-40 w-full rounded-md border border-amber-500/20 object-cover" />
              ) : (
                <div className="h-40 w-full rounded-md border border-amber-500/20 bg-slate-900/80" />
              )}

              <div className="space-y-2 text-xs text-amber-100/90">
                <p>Nivel {anima.level}</p>
                <ProgressBar value={anima.experience} max={anima.experienceMax} colorClass="bg-violet-400" />
                <p>
                  EXP {anima.experience}/{anima.experienceMax}
                </p>
                <ProgressBar value={anima.currentHp} max={anima.totalMaxHp} colorClass="bg-emerald-400" />
                <p>
                  HP {anima.currentHp}/{anima.totalMaxHp}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-amber-100">
                <div className="rounded border border-amber-500/25 bg-black/20 p-2">ATK {anima.totalAttack}</div>
                <div className="rounded border border-amber-500/25 bg-black/20 p-2">DEF {anima.totalDefense}</div>
              </div>

              {!anima.isPrimary ? (
                <Button
                  variant="outline"
                  className="w-full border-amber-500/45 text-amber-100 hover:bg-amber-500/10"
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
        <DialogContent className="max-h-[92vh] overflow-y-auto border-amber-600/35 bg-[linear-gradient(160deg,rgba(28,25,23,0.98),rgba(15,23,42,0.98))]">
          <DialogHeader>
            <DialogTitle className="text-amber-50">{selected?.nickname}</DialogTitle>
            <DialogDescription className="text-amber-200/80">
              Detalhes completos do Anima adotado e referencia da biblioteca.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                {selected.baseAnima.imageData ? (
                  <img src={selected.baseAnima.imageData} alt={selected.baseAnima.name} className="h-44 w-full rounded-md border border-amber-500/20 object-cover" />
                ) : (
                  <div className="h-44 w-full rounded-md border border-amber-500/20 bg-slate-900/80" />
                )}

                <div className="rounded border border-amber-600/20 bg-black/20 p-3 text-sm text-amber-100">
                  <p className="font-medium">
                    {selected.baseAnima.name} ({selected.baseAnima.powerLevel})
                  </p>
                  <p className="mt-1 text-amber-200/80">Nivel {selected.level}</p>
                  <div className="mt-4 space-y-2">
                    <div>
                      <p className="mb-1 text-xs text-amber-300/85">Vida</p>
                      <ProgressBar value={selected.currentHp} max={selected.totalMaxHp} colorClass="bg-emerald-400" />
                      <p className="mt-1 text-xs">
                        {selected.currentHp}/{selected.totalMaxHp}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-amber-300/85">Experiencia</p>
                      <ProgressBar value={selected.experience} max={selected.experienceMax} colorClass="bg-fuchsia-400" />
                      <p className="mt-1 text-xs">
                        {selected.experience}/{selected.experienceMax}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border-amber-600/20 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-sm text-amber-100">Atributos RPG</CardTitle>
                  <CardDescription className="text-amber-200/70">Base da biblioteca + bonus da adocao = total em combate</CardDescription>
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

              <div className="grid gap-2 md:grid-cols-3 text-xs">
                <div className="rounded border border-amber-500/20 bg-black/20 p-3 text-amber-100">
                  <Sword className="mb-2 h-4 w-4 text-amber-300" />
                  Ataque final: <strong>{selected.totalAttack}</strong>
                </div>
                <div className="rounded border border-amber-500/20 bg-black/20 p-3 text-amber-100">
                  <Shield className="mb-2 h-4 w-4 text-amber-300" />
                  Defesa final: <strong>{selected.totalDefense}</strong>
                </div>
                <div className="rounded border border-amber-500/20 bg-black/20 p-3 text-amber-100">
                  <Timer className="mb-2 h-4 w-4 text-amber-300" />
                  Velocidade final: <strong>{formatSeconds(selected.totalAttackSpeedSeconds)}</strong>
                </div>
                <div className="rounded border border-amber-500/20 bg-black/20 p-3 text-amber-100">
                  <Sparkles className="mb-2 h-4 w-4 text-amber-300" />
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
