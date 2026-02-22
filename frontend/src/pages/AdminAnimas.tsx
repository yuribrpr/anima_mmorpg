import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { getPowerScale } from "@/lib/anima-power-scale";
import { createAnima, deleteAnima, listAnimas, updateAnima } from "@/lib/animas";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { POWER_LEVEL_OPTIONS, type Anima, type CreateAnimaInput, type PowerLevel } from "@/types/anima";
import { ImageCropFlipField } from "@/components/common/ImageCropFlipField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const animaSchema = z.object({
  name: z.string().min(2, "Informe o nome do Anima"),
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
};

const powerLabel = (value: PowerLevel) => POWER_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? value;

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
});

const applyScaleToForm = (form: UseFormReturn<AnimaFormValues>, level: PowerLevel, setScalePercent: (value: number) => void) => {
  const scaled = getPowerScale(level);
  setScalePercent(scaled.scalePercent);
  form.setValue("attack", scaled.values.attack);
  form.setValue("attackSpeedSeconds", scaled.values.attackSpeedSeconds);
  form.setValue("critChance", scaled.values.critChance);
  form.setValue("agility", scaled.values.agility);
  form.setValue("defense", scaled.values.defense);
  form.setValue("maxHp", scaled.values.maxHp);
};

type FormSectionProps = {
  form: UseFormReturn<AnimaFormValues>;
  animas: Anima[];
  scalePercent: number | null;
  setScalePercent: (value: number) => void;
  powerComboboxOpen: boolean;
  setPowerComboboxOpen: (value: boolean) => void;
  evolutionComboboxOpen: boolean;
  setEvolutionComboboxOpen: (value: boolean) => void;
  excludeEvolutionId?: string;
};

const AnimaFormSection = ({
  form,
  animas,
  scalePercent,
  setScalePercent,
  powerComboboxOpen,
  setPowerComboboxOpen,
  evolutionComboboxOpen,
  setEvolutionComboboxOpen,
  excludeEvolutionId,
}: FormSectionProps) => {
  const selectedNextEvolutionId = form.watch("nextEvolutionId");
  const selectedNextEvolution = useMemo(
    () => animas.find((anima) => anima.id === selectedNextEvolutionId) ?? null,
    [animas, selectedNextEvolutionId],
  );

  const evolutionOptions = useMemo(
    () => animas.filter((anima) => anima.id !== excludeEvolutionId),
    [animas, excludeEvolutionId],
  );

  return (
    <div className="space-y-4">
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
              <FormLabel>Nível de Poder</FormLabel>
              <Popover open={powerComboboxOpen} onOpenChange={setPowerComboboxOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {powerLabel(field.value)}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar nível..." />
                    <CommandList>
                      <CommandEmpty>Nenhum nível encontrado.</CommandEmpty>
                      <CommandGroup>
                        {POWER_LEVEL_OPTIONS.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={`${option.label} ${option.value}`}
                            onSelect={() => {
                              field.onChange(option.value);
                              applyScaleToForm(form, option.value, setScalePercent);
                              setPowerComboboxOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", field.value === option.value ? "opacity-100" : "opacity-0")} />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Escala aplicada: {scalePercent ?? "-"}%</p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
          name="attackSpeedSeconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vel. Ataque (s)</FormLabel>
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
              <FormLabel>% Crítico</FormLabel>
              <FormControl>
                <Input type="number" step="0.1" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
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
          name="maxHp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vida Máxima</FormLabel>
              <FormControl>
                <Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ImageCropFlipField
          value={form.watch("imageData")}
          flipHorizontalValue={form.watch("flipHorizontal")}
          onFlipHorizontalChange={(flipHorizontal) =>
            form.setValue("flipHorizontal", flipHorizontal, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
          onChange={(imageData) =>
            form.setValue("imageData", imageData, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
          label="Imagem (Upload local)"
        />
        <FormField
          control={form.control}
          name="spriteScale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escala do Sprite</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step={0.1}
                  inputMode="decimal"
                  value={field.value}
                  onChange={(event) => {
                    const parsed = Number(event.target.value.replace(",", "."));
                    field.onChange(Number.isFinite(parsed) ? parsed : field.value);
                  }}
                  onBlur={() => field.onChange(Math.max(0.1, field.value))}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">Padrao 3x. Sem limite maximo.</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nextEvolutionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Próxima Evolução</FormLabel>
              <Popover open={evolutionComboboxOpen} onOpenChange={setEvolutionComboboxOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {field.value ? animas.find((anima) => anima.id === field.value)?.name ?? "Selecionar" : "Selecionar"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar Anima..." />
                    <CommandList>
                      <CommandEmpty>Nenhum Anima encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="sem-evolucao"
                          onSelect={() => {
                            field.onChange(null);
                            setEvolutionComboboxOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                          Sem evolução
                        </CommandItem>
                        {evolutionOptions.map((anima) => (
                          <CommandItem
                            key={anima.id}
                            value={`${anima.name} ${anima.powerLevel}`}
                            onSelect={() => {
                              field.onChange(anima.id);
                              setEvolutionComboboxOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", field.value === anima.id ? "opacity-100" : "opacity-0")} />
                            {anima.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {selectedNextEvolution ? (
        <Card className="bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Referência da próxima evolução</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {selectedNextEvolution.imageData ? (
              <img src={selectedNextEvolution.imageData} alt={selectedNextEvolution.name} className="h-16 w-16 rounded-md border border-border object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-md border border-border bg-muted" />
            )}
            <div>
              <p className="font-medium">{selectedNextEvolution.name}</p>
              <p className="text-xs text-muted-foreground">{powerLabel(selectedNextEvolution.powerLevel)}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export const AdminAnimasPage = () => {
  const [animas, setAnimas] = useState<Anima[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingAnima, setEditingAnima] = useState<Anima | null>(null);

  const [createScalePercent, setCreateScalePercent] = useState<number | null>(null);
  const [editScalePercent, setEditScalePercent] = useState<number | null>(null);
  const [createPowerOpen, setCreatePowerOpen] = useState(false);
  const [createEvolutionOpen, setCreateEvolutionOpen] = useState(false);
  const [editPowerOpen, setEditPowerOpen] = useState(false);
  const [editEvolutionOpen, setEditEvolutionOpen] = useState(false);

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
        setErrorMessage("Não foi possível carregar os Animas.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnimas();
  }, []);

  const filteredAnimas = useMemo(() => {
    return animas.filter((anima) => {
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
    });
  }, [animas, filters]);

  const handleCreate = async (values: AnimaFormValues) => {
    try {
      await createAnima(toPayload(values));
      setOpenCreateModal(false);
      createForm.reset(defaultFormValues);
      setCreateScalePercent(null);
      await fetchAnimas();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Não foi possível criar o Anima.");
      }
    }
  };

  const openEdit = (anima: Anima) => {
    setEditingAnima(anima);
    setEditScalePercent(null);
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
    });
    setOpenEditModal(true);
  };

  const handleUpdate = async (values: AnimaFormValues) => {
    if (!editingAnima) {
      return;
    }

    try {
      await updateAnima(editingAnima.id, toPayload(values));
      setOpenEditModal(false);
      setEditingAnima(null);
      await fetchAnimas();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Não foi possível editar o Anima.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnima(id);
      await fetchAnimas();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Não foi possível excluir o Anima.");
      }
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Biblioteca de Animas</h1>
          <p className="text-sm text-muted-foreground">Gerenciador global de Animas dos jogadores.</p>
        </div>

        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Anima
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Anima</DialogTitle>
              <DialogDescription>Preencha os atributos do Anima.</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form className="space-y-4" onSubmit={createForm.handleSubmit(handleCreate)}>
                <AnimaFormSection
                  form={createForm}
                  animas={animas}
                  scalePercent={createScalePercent}
                  setScalePercent={setCreateScalePercent}
                  powerComboboxOpen={createPowerOpen}
                  setPowerComboboxOpen={setCreatePowerOpen}
                  evolutionComboboxOpen={createEvolutionOpen}
                  setEvolutionComboboxOpen={setCreateEvolutionOpen}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createForm.formState.isSubmitting}>
                    {createForm.formState.isSubmitting ? "Criando..." : "Criar Anima"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Anima</DialogTitle>
            <DialogDescription>Atualize os atributos do Anima selecionado.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
              <AnimaFormSection
                form={editForm}
                animas={animas}
                scalePercent={editScalePercent}
                setScalePercent={setEditScalePercent}
                powerComboboxOpen={editPowerOpen}
                setPowerComboboxOpen={setEditPowerOpen}
                evolutionComboboxOpen={editEvolutionOpen}
                setEvolutionComboboxOpen={setEditEvolutionOpen}
                excludeEvolutionId={editingAnima?.id}
              />
              <DialogFooter>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtros dinâmicos para visualizar todos os Animas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar por nome"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between">
                {filters.powerLevel === "ALL" ? "Todos os níveis" : powerLabel(filters.powerLevel)}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Command>
                <CommandInput placeholder="Buscar nível..." />
                <CommandList>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((current) => ({ ...current, powerLevel: "ALL" }))}>Todos os níveis</CommandItem>
                    {POWER_LEVEL_OPTIONS.map((option) => (
                      <CommandItem key={option.value} onSelect={() => setFilters((current) => ({ ...current, powerLevel: option.value }))}>
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Input
            type="number"
            placeholder="Ataque mínimo"
            value={filters.minAttack}
            onChange={(event) => setFilters((current) => ({ ...current, minAttack: event.target.value }))}
          />
          <Input
            type="number"
            placeholder="Defesa mínima"
            value={filters.minDefense}
            onChange={(event) => setFilters((current) => ({ ...current, minDefense: event.target.value }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Animas cadastrados</CardTitle>
          <CardDescription>Total filtrado: {filteredAnimas.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? <p className="mb-4 text-sm text-red-400">{errorMessage}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Ataque</TableHead>
                <TableHead>Vel. Ataque (s)</TableHead>
                <TableHead>% Crítico</TableHead>
                <TableHead>Agilidade</TableHead>
                <TableHead>Defesa</TableHead>
                <TableHead>Vida Máx.</TableHead>
                <TableHead>Escala</TableHead>
                <TableHead>Próx. Evolução</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && filteredAnimas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    Nenhum Anima encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : null}

              {filteredAnimas.map((anima) => (
                <TableRow key={anima.id}>
                  <TableCell>
                    {anima.imageData ? (
                      <img src={anima.imageData} alt={anima.name} className="h-12 w-12 rounded-md border border-border object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-md border border-border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{anima.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{powerLabel(anima.powerLevel)}</Badge>
                  </TableCell>
                  <TableCell>{anima.attack}</TableCell>
                  <TableCell>{anima.attackSpeedSeconds.toFixed(2)}</TableCell>
                  <TableCell>{anima.critChance.toFixed(1)}%</TableCell>
                  <TableCell>{anima.agility}</TableCell>
                  <TableCell>{anima.defense}</TableCell>
                  <TableCell>{anima.maxHp}</TableCell>
                  <TableCell>{(anima.spriteScale ?? 3).toFixed(1)}x</TableCell>
                  <TableCell>
                    {anima.nextEvolution ? (
                      <div className="flex items-center gap-2">
                        {anima.nextEvolution.imageData ? (
                          <img src={anima.nextEvolution.imageData} alt={anima.nextEvolution.name} className="h-8 w-8 rounded border border-border object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded border border-border bg-muted" />
                        )}
                        <span>{anima.nextEvolution.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Ações
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(anima)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-400 focus:text-red-300" onClick={() => void handleDelete(anima.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
};
