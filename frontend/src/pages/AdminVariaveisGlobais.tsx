import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getGlobalSettings, updateGlobalSettings } from "@/lib/global-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const AdminVariaveisGlobaisPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expMultiplier, setExpMultiplier] = useState("1");
  const [bitsMultiplier, setBitsMultiplier] = useState("1");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const settings = await getGlobalSettings();
        setExpMultiplier(settings.expMultiplier.toString());
        setBitsMultiplier(settings.bitsMultiplier.toString());
        setErrorMessage(null);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Nao foi possivel carregar as variaveis globais.");
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSave = async () => {
    const nextExp = Number(expMultiplier);
    const nextBits = Number(bitsMultiplier);
    if (!Number.isFinite(nextExp) || !Number.isFinite(nextBits) || nextExp < 0 || nextBits < 0) {
      setErrorMessage("Informe multiplicadores validos (>= 0).");
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateGlobalSettings({
        expMultiplier: nextExp,
        bitsMultiplier: nextBits,
      });
      setExpMultiplier(updated.expMultiplier.toString());
      setBitsMultiplier(updated.bitsMultiplier.toString());
      setErrorMessage(null);
      setSuccessMessage("Variaveis globais atualizadas.");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao salvar variaveis globais.");
      }
      setSuccessMessage(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Variaveis Globais</h1>
        <p className="text-sm text-muted-foreground">Multiplicadores aplicados nas recompensas de XP e Bits do Explorar.</p>
      </header>

      {errorMessage ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p> : null}
      {successMessage ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{successMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Economia Global</CardTitle>
          <CardDescription>Use 1 para padrao, acima de 1 para bonus global e abaixo de 1 para reduzir recompensas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">Multiplicador de EXP</span>
            <Input
              type="number"
              min={0}
              max={1_000_000}
              step="0.01"
              value={expMultiplier}
              disabled={loading || saving}
              onChange={(event) => setExpMultiplier(event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">Multiplicador de Bits</span>
            <Input
              type="number"
              min={0}
              max={1_000_000}
              step="0.01"
              value={bitsMultiplier}
              disabled={loading || saving}
              onChange={(event) => setBitsMultiplier(event.target.value)}
            />
          </label>

          <div className="md:col-span-2">
            <Button onClick={() => void handleSave()} disabled={loading || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
