import { useEffect, useMemo, useState } from "react";
import { Heart, Search, Shield, Sparkles, Swords, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/api";
import { adoptAnima, listAdoptionCandidates } from "@/lib/adocoes";
import { POWER_LEVEL_OPTIONS, type PowerLevel } from "@/types/anima";
import type { AdoptionCandidate } from "@/types/adocao";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimaStatsRadar, type RadarMetric } from "@/components/common/AnimaStatsRadar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const formatAttackSpeed = (value: number) => `${value.toFixed(2)}s`;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const toSpeedScore = (seconds: number) => 1 / Math.max(seconds, 0.05);

type PowerFilter = "ALL" | PowerLevel;

export const AdocaoPage = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<AdoptionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [powerFilter, setPowerFilter] = useState<PowerFilter>("ALL");

  const selected = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return candidates.find((candidate) => candidate.id === selectedId) ?? null;
  }, [candidates, selectedId]);

  const hasCandidates = useMemo(() => candidates.length > 0, [candidates]);

  const availableLevels = useMemo(() => {
    const registered = new Set(candidates.map((candidate) => candidate.powerLevel));
    return POWER_LEVEL_OPTIONS.filter((option) => registered.has(option.value));
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (powerFilter !== "ALL" && candidate.powerLevel !== powerFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return candidate.name.toLowerCase().includes(query);
    });
  }, [candidates, powerFilter, search]);

  const radarMaxima = useMemo(() => {
    return {
      attack: Math.max(1, ...candidates.map((item) => item.attack)),
      defense: Math.max(1, ...candidates.map((item) => item.defense)),
      maxHp: Math.max(1, ...candidates.map((item) => item.maxHp)),
      crit: Math.max(1, ...candidates.map((item) => item.critChance)),
      agility: Math.max(1, ...candidates.map((item) => item.agility)),
      speed: Math.max(1, ...candidates.map((item) => toSpeedScore(item.attackSpeedSeconds))),
    };
  }, [candidates]);

  const selectedRadarMetrics = useMemo<RadarMetric[]>(() => {
    if (!selected) {
      return [];
    }

    return [
      { key: "attack", label: "ATK", value: selected.attack, max: radarMaxima.attack, displayValue: selected.attack.toString() },
      { key: "defense", label: "DEF", value: selected.defense, max: radarMaxima.defense, displayValue: selected.defense.toString() },
      { key: "hp", label: "HP", value: selected.maxHp, max: radarMaxima.maxHp, displayValue: selected.maxHp.toString() },
      {
        key: "speed",
        label: "SPD",
        value: toSpeedScore(selected.attackSpeedSeconds),
        max: radarMaxima.speed,
        displayValue: formatAttackSpeed(selected.attackSpeedSeconds),
      },
      { key: "crit", label: "CRT", value: selected.critChance, max: radarMaxima.crit, displayValue: formatPercent(selected.critChance) },
      { key: "agility", label: "AGI", value: selected.agility, max: radarMaxima.agility, displayValue: selected.agility.toString() },
    ];
  }, [radarMaxima, selected]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await listAdoptionCandidates();
      setCandidates(data);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel carregar os candidatos de adocao.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCandidates();
  }, []);

  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedId(null);
      setNickname("");
      return;
    }

    if (selectedId && candidates.some((candidate) => candidate.id === selectedId)) {
      return;
    }

    const first = candidates[0];
    setSelectedId(first.id);
    setNickname(first.name);
  }, [candidates, selectedId]);

  const selectCandidate = (candidate: AdoptionCandidate) => {
    setSelectedId(candidate.id);
    setNickname(candidate.name);
  };

  const handleAdopt = async () => {
    if (!selected) {
      return;
    }

    const sanitizedNickname = nickname.trim();
    if (sanitizedNickname.length < 2) {
      setErrorMessage("O apelido precisa ter ao menos 2 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      await adoptAnima({
        animaId: selected.id,
        nickname: sanitizedNickname,
      });
      setSelectedId(null);
      setNickname("");
      await fetchCandidates();
      navigate("/app/inventario");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel concluir a adocao.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Adocao de Animas</p>
          </div>
          <CardTitle className="text-3xl tracking-tight">Escolha seu proximo companheiro</CardTitle>
          <CardDescription>
            Painel rapido para comparar candidatos, definir apelido e concluir a adocao em um unico fluxo.
          </CardDescription>
        </CardHeader>
      </Card>

      {errorMessage ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errorMessage}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Candidatos totais</CardDescription>
            <CardTitle className="text-2xl">{candidates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Filtrados agora</CardDescription>
            <CardTitle className="text-2xl">{filteredCandidates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Selecionado</CardDescription>
            <CardTitle className="truncate text-xl">{selected?.name ?? "Nenhum"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl">Candidatos</CardTitle>
                <CardDescription>Selecione para comparar e adotar.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchCandidates()} disabled={loading}>
                {loading ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por nome..." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={powerFilter === "ALL" ? "default" : "outline"} size="sm" onClick={() => setPowerFilter("ALL")}>
                Todos
              </Button>
              {availableLevels.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={powerFilter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPowerFilter(option.value)}
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

            {!loading && !hasCandidates ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum anima disponivel para adocao no momento.
              </div>
            ) : null}

            {!loading && hasCandidates && filteredCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum candidato encontrado com esse filtro.
              </div>
            ) : null}

            {!loading
              ? filteredCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectCandidate(candidate)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      candidate.id === selectedId ? "border-primary/70 bg-muted/60" : "border-border bg-card/40 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {candidate.imageData ? (
                        <img
                          src={candidate.imageData}
                          alt={candidate.name}
                          className="h-14 w-14 rounded-md border border-border bg-muted/20 p-1 object-contain"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md border border-border bg-muted/40" />
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{candidate.name}</p>
                            <p className="text-xs text-muted-foreground">Pronto para adocao</p>
                          </div>
                          <Badge variant="secondary">{candidate.powerLevel}</Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md border border-border bg-muted/30 px-2 py-1">ATK {candidate.attack}</div>
                          <div className="rounded-md border border-border bg-muted/30 px-2 py-1">DEF {candidate.defense}</div>
                          <div className="rounded-md border border-border bg-muted/30 px-2 py-1">HP {candidate.maxHp}</div>
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
            <CardTitle className="text-xl">Painel de adocao</CardTitle>
            <CardDescription>Confira os stats e finalize sem abrir modal.</CardDescription>
          </CardHeader>

          <CardContent>
            {!selected ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Selecione um candidato para iniciar a adocao.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{selected.name}</p>
                    <p className="text-sm text-muted-foreground">Classe base para equipe principal</p>
                  </div>
                  <Badge>{selected.powerLevel}</Badge>
                </div>

                {selected.imageData ? (
                  <div className="flex h-52 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20 p-2">
                    <img src={selected.imageData} alt={selected.name} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-52 w-full rounded-lg border border-border bg-muted/40" />
                )}

                {selectedRadarMetrics.length > 0 ? <AnimaStatsRadar metrics={selectedRadarMetrics} title="Radar de status" /> : null}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Swords className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Ataque: <strong>{selected.attack}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Shield className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Defesa: <strong>{selected.defense}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Heart className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Vida maxima: <strong>{selected.maxHp}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Zap className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    Velocidade: <strong>{formatAttackSpeed(selected.attackSpeedSeconds)}</strong>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <p className="mb-2 font-medium">Atributos extras</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-muted-foreground">Critico</p>
                    <p className="text-right">{formatPercent(selected.critChance)}</p>
                    <p className="text-muted-foreground">Agilidade</p>
                    <p className="text-right">{selected.agility}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="adoption_nickname" className="text-sm">
                    Apelido do Anima
                  </label>
                  <Input
                    id="adoption_nickname"
                    placeholder="Ex: Lumen"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Minimo de 2 caracteres. Voce sera redirecionado para o inventario apos adotar.</p>
                </div>

                <Button className="w-full gap-2" onClick={() => void handleAdopt()} disabled={submitting || nickname.trim().length < 2}>
                  <Sparkles className="h-4 w-4" />
                  {submitting ? "Adotando..." : `Adotar ${selected.name}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
