import { useEffect, useMemo, useState } from "react";
import { Shield, Sparkles, Swords, Zap } from "lucide-react";
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
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Adocao de Animas</p>
          </div>
          <CardTitle className="text-3xl tracking-tight">Escolha seu companheiro rookie</CardTitle>
          <CardDescription>
            Apenas Animas rookie ficam disponiveis para adocao. Defina um nome para registrar o novo aliado no inventario.
          </CardDescription>
        </CardHeader>
      </Card>

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}

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
          <Card key={anima.id} className="transition-shadow hover:shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{anima.name}</CardTitle>
                  <CardDescription>Classe base Rookie</CardDescription>
                </div>
                <Badge variant="secondary">{anima.powerLevel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {anima.imageData ? (
                <img src={anima.imageData} alt={anima.name} className="h-40 w-full rounded-md border object-cover" />
              ) : (
                <div className="h-40 w-full rounded-md border bg-muted/30" />
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Ataque</p>
                  <p className="font-semibold">{anima.attack}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Defesa</p>
                  <p className="font-semibold">{anima.defense}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Vida Max</p>
                  <p className="font-semibold">{anima.maxHp}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Vel. Ataque</p>
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
            <DialogTitle>Confirmar adocao</DialogTitle>
            <DialogDescription>Defina o nome do Anima adotado para concluir o vinculo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-medium">{selected?.name}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
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
