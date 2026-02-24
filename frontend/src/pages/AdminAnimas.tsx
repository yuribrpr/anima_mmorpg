import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, Pencil, Plus, Shield, Sparkles, Swords, Timer, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getPowerScale } from "@/lib/anima-power-scale";
import { createAnima, deleteAnima, listAnimas, updateAnima } from "@/lib/animas";
import { ApiError } from "@/lib/api";
import { POWER_LEVEL_OPTIONS, type Anima, type CreateAnimaInput, type PowerLevel } from "@/types/anima";
import { ImageCropFlipField } from "@/components/common/ImageCropFlipField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const animaSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  attack: z.number().int().min(1),
  attackSpeedSeconds: z.number().min(0.1),
  critChance: z.number().min(0).max(100),
  agility: z.number().int().min(1),
  defense: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  imageData: z.string().nullable(),
  spriteScale: z.number().positive(),
  flipHorizontal: z.boolean(),
  powerLevel: z.enum(["ROOKIE", "CHAMPION", "ULTIMATE", "MEGA", "BURST_MODE"]),
  nextEvolutionId: z.string().nullable(),
  previousEvolutionId: z.string().nullable(),
  nextEvolutionLevelRequired: z.number().int().min(1).max(999),
});

type AnimaFormValues = z.infer<typeof animaSchema>;

const defaultFormValues: AnimaFormValues = {
  name: "",
  attack: 65,
  attackSpeedSeconds: 1.8,
  critChance: 8,
  agility: 62,
  defense: 58,
  maxHp: 520,
  imageData: null,
  spriteScale: 3,
  flipHorizontal: true,
  powerLevel: "ROOKIE",
  nextEvolutionId: null,
  previousEvolutionId: null,
  nextEvolutionLevelRequired: 10,
};

const toPayload = (values: AnimaFormValues): CreateAnimaInput => ({
  name: values.name,
  attack: values.attack,
  attackSpeedSeconds: values.attackSpeedSeconds,
  critChance: values.critChance,
  agility: values.agility,
  defense: values.defense,
  maxHp: values.maxHp,
  imageData: values.imageData,
  spriteScale: values.spriteScale,
  flipHorizontal: values.flipHorizontal,
  powerLevel: values.powerLevel,
  nextEvolutionId: values.nextEvolutionId,
  previousEvolutionId: values.previousEvolutionId,
  nextEvolutionLevelRequired: values.nextEvolutionLevelRequired,
});

const powerLabel = (value: PowerLevel) => POWER_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? value;

const applyPowerScale = (form: ReturnType<typeof useForm<AnimaFormValues>>, level: PowerLevel) => {
  const scaled = getPowerScale(level);
  form.setValue("attack", scaled.values.attack, { shouldDirty: true });
  form.setValue("attackSpeedSeconds", scaled.values.attackSpeedSeconds, { shouldDirty: true });
  form.setValue("critChance", scaled.values.critChance, { shouldDirty: true });
  form.setValue("agility", scaled.values.agility, { shouldDirty: true });
  form.setValue("defense", scaled.values.defense, { shouldDirty: true });
  form.setValue("maxHp", scaled.values.maxHp, { shouldDirty: true });
};

const AnimaFormFields = ({
  form,
  animas,
  excludeEvolutionId,
}: {
  form: ReturnType<typeof useForm<AnimaFormValues>>;
  animas: Anima[];
  excludeEvolutionId?: string;
}) => {
  const selectedPowerLevel = form.watch("powerLevel");
  const selectedNextEvolutionId = form.watch("nextEvolutionId");
  const selectedNextEvolution = useMemo(
    () => animas.find((anima) => anima.id === selectedNextEvolutionId) ?? null,
    [animas, selectedNextEvolutionId],
  );
  const selectedPreviousEvolutionId = form.watch("previousEvolutionId");
  const selectedPreviousEvolution = useMemo(
    () => animas.find((anima) => anima.id === selectedPreviousEvolutionId) ?? null,
    [animas, selectedPreviousEvolutionId],
  );
  const evolutionOptions = useMemo(
    () => animas.filter((anima) => anima.id !== excludeEvolutionId),
    [animas, excludeEvolutionId],
  );
  const recommendedScale = getPowerScale(selectedPowerLevel);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Identificacao</p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Drakoid" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="powerLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nivel de poder</FormLabel>
                  <FormControl>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={field.value}
                      onChange={(event) => {
                        const nextLevel = event.target.value as PowerLevel;
                        field.onChange(nextLevel);
                        applyPowerScale(form, nextLevel);
                      }}
                    >
                      {POWER_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Escala recomendada: {recommendedScale.scalePercent}%</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="nextEvolutionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proxima evolucao</FormLabel>
                <FormControl>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value || null)}
                  >
                    <option value="">Sem evolucao</option>
                    {evolutionOptions
                      .filter((anima) => anima.id !== selectedPreviousEvolutionId)
                      .map((anima) => (
                      <option key={anima.id} value={anima.id}>
                        {anima.name}
                      </option>
                      ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="previousEvolutionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Evolucao anterior</FormLabel>
                <FormControl>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value || null)}
                  >
                    <option value="">Sem evolucao anterior</option>
                    {evolutionOptions
                      .filter((anima) => anima.id !== selectedNextEvolutionId)
                      .map((anima) => (
                        <option key={anima.id} value={anima.id}>
                          {anima.name}
                        </option>
                      ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextEvolutionLevelRequired"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nivel minimo para evolucao</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={999} value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status de combate</p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="attack"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ataque</FormLabel>
                  <FormControl>
                    <Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defense"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Defesa</FormLabel>
                  <FormControl>
                    <Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agilidade</FormLabel>
                  <FormControl>
                    <Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxHp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vida maxima</FormLabel>
                  <FormControl>
                    <Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="attackSpeedSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Velocidade de ataque (s)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="critChance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Critico (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sprite</p>
          <ImageCropFlipField
            value={form.watch("imageData")}
            flipHorizontalValue={form.watch("flipHorizontal")}
            onFlipHorizontalChange={(flipHorizontal) => form.setValue("flipHorizontal", flipHorizontal, { shouldDirty: true })}
            onChange={(imageData) => form.setValue("imageData", imageData, { shouldDirty: true })}
            label="Imagem do anima"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="spriteScale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escala do sprite</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flipHorizontal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orientacao base</FormLabel>
                  <FormControl>
                    <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                      <input type="checkbox" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} className="h-4 w-4" />
                      Inverter horizontalmente
                    </label>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {form.watch("imageData") ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview orientacao</p>
            <div className="flex items-center justify-center rounded-md border bg-background/60 p-3">
              <img
                src={form.watch("imageData") ?? ""}
                alt="Preview do anima"
                className="h-24 w-24 object-contain"
                style={{ transform: form.watch("flipHorizontal") ? "scaleX(-1)" : "scaleX(1)", imageRendering: "pixelated" }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{form.watch("flipHorizontal") ? "Estado: invertido" : "Estado: normal"}</p>
          </div>
        ) : null}

        {selectedNextEvolution ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview da evolucao</p>
            <div className="flex items-center gap-3 rounded-md border bg-background/60 p-3">
              {selectedNextEvolution.imageData ? (
                <img src={selectedNextEvolution.imageData} alt={selectedNextEvolution.name} className="h-14 w-14 object-contain" />
              ) : (
                <div className="h-14 w-14 rounded-md border bg-muted" />
              )}
              <div>
                <p className="text-sm font-semibold">{selectedNextEvolution.name}</p>
                <p className="text-xs text-muted-foreground">{powerLabel(selectedNextEvolution.powerLevel)}</p>
              </div>
            </div>
          </div>
        ) : null}

        {selectedPreviousEvolution ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview da evolucao anterior</p>
            <div className="flex items-center gap-3 rounded-md border bg-background/60 p-3">
              {selectedPreviousEvolution.imageData ? (
                <img src={selectedPreviousEvolution.imageData} alt={selectedPreviousEvolution.name} className="h-14 w-14 object-contain" />
              ) : (
                <div className="h-14 w-14 rounded-md border bg-muted" />
              )}
              <div>
                <p className="text-sm font-semibold">{selectedPreviousEvolution.name}</p>
                <p className="text-xs text-muted-foreground">{powerLabel(selectedPreviousEvolution.powerLevel)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const AdminAnimasPage = () => {
  const [animas, setAnimas] = useState<Anima[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedAnimaId, setSelectedAnimaId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"details" | "edit">("details");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    powerLevel: "ALL" as "ALL" | PowerLevel,
    minAttack: "",
    minDefense: "",
  });

  const createForm = useForm<AnimaFormValues>({
    resolver: zodResolver(animaSchema),
    defaultValues: defaultFormValues,
  });
  const editForm = useForm<AnimaFormValues>({
    resolver: zodResolver(animaSchema),
    defaultValues: defaultFormValues,
  });

  const fetchAnimas = async () => {
    setLoading(true);
    try {
      const data = await listAnimas();
      setAnimas(data);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel carregar os animas.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnimas();
  }, []);

  const selectedAnima = useMemo(
    () => (selectedAnimaId ? animas.find((anima) => anima.id === selectedAnimaId) ?? null : null),
    [animas, selectedAnimaId],
  );

  const loadEditForm = (anima: Anima) => {
    editForm.reset({
      name: anima.name,
      attack: anima.attack,
      attackSpeedSeconds: anima.attackSpeedSeconds,
      critChance: anima.critChance,
      agility: anima.agility,
      defense: anima.defense,
      maxHp: anima.maxHp,
      imageData: anima.imageData,
      spriteScale: anima.spriteScale ?? 3,
      flipHorizontal: anima.flipHorizontal ?? true,
      powerLevel: anima.powerLevel,
      nextEvolutionId: anima.nextEvolutionId,
      previousEvolutionId: anima.previousEvolutionId,
      nextEvolutionLevelRequired: anima.nextEvolutionLevelRequired,
    });
  };

  useEffect(() => {
    if (selectedAnima) {
      loadEditForm(selectedAnima);
    }
  }, [selectedAnima]);

  const filteredAnimas = useMemo(() => {
    return [...animas]
      .filter((anima) => {
        if (filters.search && !anima.name.toLowerCase().includes(filters.search.toLowerCase())) {
          return false;
        }
        if (filters.powerLevel !== "ALL" && anima.powerLevel !== filters.powerLevel) {
          return false;
        }
        if (filters.minAttack && anima.attack < Number(filters.minAttack)) {
          return false;
        }
        if (filters.minDefense && anima.defense < Number(filters.minDefense)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [animas, filters]);

  const handleCreate = async (values: AnimaFormValues) => {
    try {
      await createAnima(toPayload(values));
      setOpenCreateModal(false);
      createForm.reset(defaultFormValues);
      await fetchAnimas();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao criar anima.");
      }
    }
  };

  const handleUpdate = async (values: AnimaFormValues) => {
    if (!selectedAnima) return;
    try {
      await updateAnima(selectedAnima.id, toPayload(values));
      await fetchAnimas();
      setSelectedTab("details");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao editar anima.");
      }
    }
  };

  const handleDelete = async (anima: Anima) => {
    if (!window.confirm(`Excluir o anima "${anima.name}"?`)) {
      return;
    }

    setDeletingId(anima.id);
    try {
      await deleteAnima(anima.id);
      if (selectedAnimaId === anima.id) {
        setSelectedAnimaId(null);
      }
      await fetchAnimas();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao excluir anima.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openAnimaModal = (anima: Anima, tab: "details" | "edit" = "details") => {
    setSelectedAnimaId(anima.id);
    setSelectedTab(tab);
    if (tab === "edit") {
      loadEditForm(anima);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Biblioteca de animas</h1>
          <p className="text-sm text-muted-foreground">Gerencie animas com visual em cards, modal de detalhes e edicao integrada.</p>
        </div>

        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar anima
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>Novo anima</DialogTitle>
              <DialogDescription>Configure status, sprite e cadeia de evolucao.</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form className="space-y-4" onSubmit={createForm.handleSubmit(handleCreate)}>
                <AnimaFormFields form={createForm} animas={animas} />
                <DialogFooter>
                  <Button type="submit" disabled={createForm.formState.isSubmitting}>
                    {createForm.formState.isSubmitting ? "Criando..." : "Criar anima"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      {errorMessage ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre por nome, nivel de poder e status minimos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Buscar por nome..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={filters.powerLevel}
            onChange={(event) => setFilters((current) => ({ ...current, powerLevel: event.target.value as "ALL" | PowerLevel }))}
          >
            <option value="ALL">Todos os niveis</option>
            {POWER_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input type="number" placeholder="Ataque minimo" value={filters.minAttack} onChange={(event) => setFilters((current) => ({ ...current, minAttack: event.target.value }))} />
          <Input type="number" placeholder="Defesa minima" value={filters.minDefense} onChange={(event) => setFilters((current) => ({ ...current, minDefense: event.target.value }))} />
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(selectedAnima)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAnimaId(null);
            setSelectedTab("details");
            editForm.reset(defaultFormValues);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          {selectedAnima ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAnima.name}</DialogTitle>
                <DialogDescription>Dados de combate, evolucao e configuracao visual.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 rounded-md border bg-muted/20 p-1">
                  <button
                    type="button"
                    className={`rounded-sm px-3 py-2 text-sm transition ${selectedTab === "details" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSelectedTab("details")}
                  >
                    Detalhes
                  </button>
                  <button
                    type="button"
                    className={`rounded-sm px-3 py-2 text-sm transition ${selectedTab === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSelectedTab("edit")}
                  >
                    Edicao
                  </button>
                </div>

                {selectedTab === "details" ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                      <div className="rounded-xl border bg-muted/20 p-3">
                        {selectedAnima.imageData ? (
                          <img
                            src={selectedAnima.imageData}
                            alt={selectedAnima.name}
                            className="mx-auto h-40 w-full object-contain"
                            style={{ transform: selectedAnima.flipHorizontal ? "scaleX(-1)" : "scaleX(1)", imageRendering: "pixelated" }}
                          />
                        ) : (
                          <div className="h-40 rounded-md border bg-muted" />
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{powerLabel(selectedAnima.powerLevel)}</Badge>
                          <Badge variant="outline">Sprite {selectedAnima.spriteScale.toFixed(1)}x</Badge>
                          <Badge variant="outline">{selectedAnima.flipHorizontal ? "Invertido" : "Normal"}</Badge>
                          <Badge variant="outline">{selectedAnima.previousEvolution ? `Prev <- ${selectedAnima.previousEvolution.name}` : "Sem regressao"}</Badge>
                          <Badge variant="outline">{selectedAnima.nextEvolution ? `Evolve -> ${selectedAnima.nextEvolution.name}` : "Sem evolucao"}</Badge>
                          <Badge variant="outline">Nivel evo: {selectedAnima.nextEvolutionLevelRequired}</Badge>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">
                              <Swords className="h-3.5 w-3.5" />
                              ATK
                            </div>
                            <p className="font-semibold">{selectedAnima.attack}</p>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">
                              <Shield className="h-3.5 w-3.5" />
                              DEF
                            </div>
                            <p className="font-semibold">{selectedAnima.defense}</p>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">
                              <Heart className="h-3.5 w-3.5" />
                              HP Max
                            </div>
                            <p className="font-semibold">{selectedAnima.maxHp}</p>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">
                              <Timer className="h-3.5 w-3.5" />
                              Atk Speed
                            </div>
                            <p className="font-semibold">{selectedAnima.attackSpeedSeconds.toFixed(2)}s</p>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">
                              <Sparkles className="h-3.5 w-3.5" />
                              Critico
                            </div>
                            <p className="font-semibold">{selectedAnima.critChance.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setSelectedTab("edit")}>
                        <Pencil className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="destructive" onClick={() => void handleDelete(selectedAnima)} disabled={deletingId === selectedAnima.id}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        {deletingId === selectedAnima.id ? "Excluindo..." : "Excluir"}
                      </Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <Form {...editForm}>
                    <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
                      <AnimaFormFields form={editForm} animas={animas} excludeEvolutionId={selectedAnima.id} />
                      <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => setSelectedTab("details")}>
                          Voltar para detalhes
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => void handleDelete(selectedAnima)} disabled={deletingId === selectedAnima.id}>
                          {deletingId === selectedAnima.id ? "Excluindo..." : "Excluir"}
                        </Button>
                        <Button type="submit" disabled={editForm.formState.isSubmitting}>
                          {editForm.formState.isSubmitting ? "Salvando..." : "Salvar alteracoes"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Animas</CardTitle>
          <CardDescription>Visualizacao em tabela para abrir detalhes, editar e excluir.</CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && filteredAnimas.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum anima encontrado com os filtros atuais.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anima</TableHead>
                  <TableHead>Poder</TableHead>
                  <TableHead>ATK/DEF/HP</TableHead>
                  <TableHead>Velocidade</TableHead>
                  <TableHead>Evolucao</TableHead>
                  <TableHead>Orientacao</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimas.map((anima) => (
                  <TableRow key={anima.id}>
                    <TableCell>
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => openAnimaModal(anima, "details")}>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                          {anima.imageData ? (
                            <img
                              src={anima.imageData}
                              alt={anima.name}
                              className="h-10 w-10 object-contain"
                              style={{ transform: anima.flipHorizontal ? "scaleX(-1)" : "scaleX(1)", imageRendering: "pixelated" }}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded border bg-muted" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{anima.name}</p>
                          <p className="text-xs text-muted-foreground">Lv evo {anima.nextEvolutionLevelRequired}</p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{powerLabel(anima.powerLevel)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">ATK {anima.attack} . DEF {anima.defense} . HP {anima.maxHp}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {anima.attackSpeedSeconds.toFixed(2)}s . Crit {anima.critChance.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {anima.previousEvolution ? `Prev: ${anima.previousEvolution.name}` : "Sem prev"} .{" "}
                      {anima.nextEvolution ? `Evo: ${anima.nextEvolution.name}` : "Sem evo"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{anima.flipHorizontal ? "Invertido" : "Normal"}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openAnimaModal(anima, "edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void handleDelete(anima)} disabled={deletingId === anima.id}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
