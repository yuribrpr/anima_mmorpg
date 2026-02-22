import { useEffect, useMemo, useState } from "react";
import { Crown, Shield, Sparkles, Swords, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/api";
import { adoptAnima, listAdoptionCandidates } from "@/lib/adocoes";
import type { AdoptionCandidate } from "@/types/adocao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const formatAttackSpeed = (value: number) => `${value.toFixed(2)}s`;

export const AdocaoPage = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<AdoptionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdoptionCandidate | null>(null);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasCandidates = useMemo(() => candidates.length > 0, [candidates]);

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

  const handleAdopt = async () => {
    if (!selected) {
      return;
    }

    setSubmitting(true);
    try {
      await adoptAnima({
        animaId: selected.id,
        nickname,
      });
      setSelected(null);
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
      <header className="rounded-xl border border-amber-700/40 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_rgba(15,23,42,0.95))] p-6 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
        <div className="flex items-center gap-2 text-amber-300">
          <Crown className="h-5 w-5" />
          <p className="text-sm uppercase tracking-[0.2em]">Santuario de Adocao</p>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-amber-50">Escolha seu primeiro companheiro</h1>
        <p className="mt-2 max-w-3xl text-sm text-amber-100/80">
          Apenas Animas de nivel Rookie podem ser adotados. Escolha um nome unico para registrar o novo aliado no seu inventario.
        </p>
      </header>

      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!loading && !hasCandidates ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle>Nenhum rookie disponivel</CardTitle>
              <CardDescription>Cadastre Animas rookie na biblioteca para liberar novas adocoes.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {candidates.map((anima) => (
          <Card
            key={anima.id}
            className="border-amber-600/30 bg-[linear-gradient(145deg,rgba(120,53,15,0.28),rgba(15,23,42,0.8))] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-amber-50">{anima.name}</CardTitle>
                  <CardDescription className="text-amber-200/75">Classe base Rookie</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-amber-300/20 text-amber-100">
                  {anima.powerLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {anima.imageData ? (
                <img src={anima.imageData} alt={anima.name} className="h-40 w-full rounded-md border border-amber-500/25 object-cover" />
              ) : (
                <div className="h-40 w-full rounded-md border border-amber-500/25 bg-slate-900/60" />
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-amber-100">
                <div className="rounded border border-amber-500/25 bg-black/20 p-2">
                  <p className="text-amber-300/80">Ataque</p>
                  <p className="font-semibold">{anima.attack}</p>
                </div>
                <div className="rounded border border-amber-500/25 bg-black/20 p-2">
                  <p className="text-amber-300/80">Defesa</p>
                  <p className="font-semibold">{anima.defense}</p>
                </div>
                <div className="rounded border border-amber-500/25 bg-black/20 p-2">
                  <p className="text-amber-300/80">Vida Max</p>
                  <p className="font-semibold">{anima.maxHp}</p>
                </div>
                <div className="rounded border border-amber-500/25 bg-black/20 p-2">
                  <p className="text-amber-300/80">Vel. Ataque</p>
                  <p className="font-semibold">{formatAttackSpeed(anima.attackSpeedSeconds)}</p>
                </div>
              </div>

              <Button className="w-full" onClick={() => setSelected(anima)}>
                Adotar {anima.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setNickname("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ritual de adocao</DialogTitle>
            <DialogDescription>Defina o nome do Anima adotado para concluir o vinculo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-amber-600/30 bg-amber-950/20 p-4">
              <p className="text-sm font-medium text-amber-100">{selected?.name}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-amber-100/85">
                <div className="flex items-center gap-2">
                  <Swords className="h-3.5 w-3.5" />
                  Ataque base: {selected?.attack}
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Defesa base: {selected?.defense}
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Critico base: {selected?.critChance.toFixed(1)}%
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" />
                  Velocidade base: {selected ? formatAttackSpeed(selected.attackSpeedSeconds) : "-"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="adoption_nickname" className="text-sm">
                Nome do seu Anima
              </label>
              <Input
                id="adoption_nickname"
                placeholder="Ex: Lumen"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleAdopt()} disabled={submitting || nickname.trim().length < 2}>
              {submitting ? "Adotando..." : "Confirmar adocao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
