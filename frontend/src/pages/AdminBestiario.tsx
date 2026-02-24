import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, MapPin, Pencil, Plus, Shield, Sparkles, Swords, Timer, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { createBestiaryAnima, deleteBestiaryAnima, listBestiaryAnimas, updateBestiaryAnima } from "@/lib/bestiario";
import { listItems } from "@/lib/itens";
import { getMapById, listMaps } from "@/lib/mapas";
import type { BestiaryAnima, CreateBestiaryAnimaInput } from "@/types/bestiary-anima";
import { POWER_LEVEL_OPTIONS, type PowerLevel } from "@/types/anima";
import type { Item } from "@/types/item";
import type { GameMap } from "@/types/mapa";
import { ImageCropFlipField } from "@/components/common/ImageCropFlipField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MapPresenceEntry = {
  mapId: string;
  mapName: string;
  groups: number;
};

const dropSchema = z.object({
  itemId: z.string().min(1, "Selecione o item"),
  quantity: z.number().int().min(1),
  dropChance: z.number().min(0).max(100),
});

const bestiarySchema = z.object({
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
  bitsDrop: z.number().int().min(0),
  xpDrop: z.number().int().min(0),
  drops: z.array(dropSchema).max(30),
});

type BestiaryFormValues = z.infer<typeof bestiarySchema>;

const defaultValues: BestiaryFormValues = {
  name: "",
  attack: 65,
  attackSpeedSeconds: 1.8,
  critChance: 8,
  agility: 62,
  defense: 58,
  maxHp: 520,
  imageData: null,
  spriteScale: 3,
  flipHorizontal: false,
  powerLevel: "ROOKIE",
  bitsDrop: Math.round((65 + 58) * 0.05),
  xpDrop: Math.round((65 + 58) * 0.15),
  drops: [],
};

const toPayload = (values: BestiaryFormValues): CreateBestiaryAnimaInput => ({
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
  bitsDrop: values.bitsDrop,
  xpDrop: values.xpDrop,
  drops: values.drops,
});

const powerLabel = (value: string) => POWER_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value;
const invertLabel = (flipHorizontal: boolean) => (flipHorizontal ? "Invertido" : "Normal");

const DropsEditor = ({
  items,
  fields,
  remove,
  append,
  control,
}: {
  items: Item[];
  fields: { id: string }[];
  remove: (index: number) => void;
  append: (value: { itemId: string; quantity: number; dropChance: number }) => void;
  control: ReturnType<typeof useForm<BestiaryFormValues>>["control"];
}) => (
  <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">Drops</p>
      <Button type="button" size="sm" variant="outline" onClick={() => append({ itemId: items[0]?.id ?? "", quantity: 1, dropChance: 10 })}>
        <Plus className="mr-1 h-4 w-4" />
        Adicionar
      </Button>
    </div>
    {fields.length === 0 ? <p className="text-xs text-muted-foreground">Sem drops configurados.</p> : null}
    {fields.map((field, index) => (
      <div key={field.id} className="grid gap-2 rounded-md border bg-background p-2 md:grid-cols-[1fr_90px_110px_auto]">
        <FormField
          control={control}
          name={`drops.${index}.itemId`}
          render={({ field: itemField }) => (
            <FormItem>
              <FormLabel className="text-xs">Item</FormLabel>
              <FormControl>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={itemField.value}
                  onChange={(event) => itemField.onChange(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`drops.${index}.quantity`}
          render={({ field: qtyField }) => (
            <FormItem>
              <FormLabel className="text-xs">Qtd</FormLabel>
              <FormControl>
                <Input type="number" value={qtyField.value} onChange={(event) => qtyField.onChange(Number(event.target.value))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`drops.${index}.dropChance`}
          render={({ field: chanceField }) => (
            <FormItem>
              <FormLabel className="text-xs">Chance %</FormLabel>
              <FormControl>
                <Input type="number" value={chanceField.value} onChange={(event) => chanceField.onChange(Number(event.target.value))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-end">
          <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ))}
  </div>
);

const AnimaFormFields = ({
  form,
  drops,
  items,
}: {
  form: ReturnType<typeof useForm<BestiaryFormValues>>;
  drops: ReturnType<typeof useFieldArray<BestiaryFormValues, "drops">>;
  items: Item[];
}) => {
  const applyDropSuggestion = () => {
    const attack = Math.max(1, Number(form.getValues("attack")) || 1);
    const defense = Math.max(1, Number(form.getValues("defense")) || 1);
    const totalPower = attack + defense;
    form.setValue("bitsDrop", Math.round(totalPower * 0.05), { shouldDirty: true });
    form.setValue("xpDrop", Math.round(totalPower * 0.15), { shouldDirty: true });
  };

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
                  <Input placeholder="Ex: Ferox" {...field} />
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
                  <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={field.value} onChange={(event) => field.onChange(event.target.value)}>
                    {POWER_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
          <FormField
            control={form.control}
            name="bitsDrop"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drop de Bits</FormLabel>
                <FormControl>
                  <Input type="number" min={0} value={field.value} onChange={(event) => field.onChange(Math.max(0, Number(event.target.value) || 0))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="xpDrop"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drop de XP</FormLabel>
                <FormControl>
                  <Input type="number" min={0} value={field.value} onChange={(event) => field.onChange(Math.max(0, Number(event.target.value) || 0))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">Sugestao de balanceamento: XP = 15% e Bits = 5% de (ATK + DEF).</p>
          <Button type="button" size="sm" variant="outline" onClick={applyDropSuggestion}>
            Recalcular auto
          </Button>
        </div>
      </div>

      <DropsEditor items={items} fields={drops.fields} append={drops.append} remove={drops.remove} control={form.control} />
    </div>

    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sprite</p>
        <ImageCropFlipField
          value={form.watch("imageData")}
          onChange={(imageData) => form.setValue("imageData", imageData, { shouldDirty: true })}
          label="Imagem do inimigo"
          enableFlip={false}
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
                <FormLabel>Inverter</FormLabel>
                <FormControl>
                  <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                    <input type="checkbox" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} className="h-4 w-4" />
                    Inverter sprite horizontalmente
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
              alt="Preview do inimigo"
              className="h-24 w-24 object-contain"
              style={{ transform: form.watch("flipHorizontal") ? "scaleX(-1)" : "scaleX(1)", imageRendering: "pixelated" }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Estado: {invertLabel(form.watch("flipHorizontal"))}</p>
        </div>
      ) : null}
    </div>
  </div>
  );
};

export const AdminBestiarioPage = () => {
  const [animas, setAnimas] = useState<BestiaryAnima[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedAnimaId, setSelectedAnimaId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"details" | "edit">("details");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    powerLevel: "ALL" as "ALL" | PowerLevel,
    mapId: "ALL",
  });

  const form = useForm<BestiaryFormValues>({
    resolver: zodResolver(bestiarySchema),
    defaultValues,
  });
  const editForm = useForm<BestiaryFormValues>({
    resolver: zodResolver(bestiarySchema),
    defaultValues,
  });
  const createDrops = useFieldArray({ control: form.control, name: "drops" });
  const editDrops = useFieldArray({ control: editForm.control, name: "drops" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [animaData, itemData, mapList] = await Promise.all([listBestiaryAnimas(), listItems(), listMaps()]);
      const fullMaps = await Promise.all(mapList.map((map) => getMapById(map.id)));
      setAnimas(animaData);
      setItems(itemData);
      setMaps(fullMaps);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Nao foi possivel carregar o bestiario.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const mapPresenceByAnima = useMemo(() => {
    const presence = new Map<string, MapPresenceEntry[]>();

    for (const map of maps) {
      const grouped = new Map<string, number>();
      for (const spawn of map.enemySpawns ?? []) {
        grouped.set(spawn.bestiaryAnimaId, (grouped.get(spawn.bestiaryAnimaId) ?? 0) + 1);
      }

      for (const [animaId, groups] of grouped.entries()) {
        const current = presence.get(animaId) ?? [];
        current.push({
          mapId: map.id,
          mapName: map.name,
          groups,
        });
        presence.set(animaId, current);
      }
    }

    return presence;
  }, [maps]);

  const selectedAnima = useMemo(
    () => (selectedAnimaId ? animas.find((anima) => anima.id === selectedAnimaId) ?? null : null),
    [animas, selectedAnimaId],
  );

  const loadEditForm = (anima: BestiaryAnima) => {
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
      flipHorizontal: anima.flipHorizontal ?? false,
      powerLevel: anima.powerLevel,
      bitsDrop: anima.bitsDrop,
      xpDrop: anima.xpDrop,
      drops: anima.drops.map((drop) => ({
        itemId: drop.itemId,
        quantity: drop.quantity,
        dropChance: drop.dropChance,
      })),
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
        if (filters.mapId !== "ALL") {
          const onMaps = mapPresenceByAnima.get(anima.id) ?? [];
          if (!onMaps.some((entry) => entry.mapId === filters.mapId)) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [animas, filters.mapId, filters.powerLevel, filters.search, mapPresenceByAnima]);

  const handleCreate = async (values: BestiaryFormValues) => {
    try {
      await createBestiaryAnima(toPayload(values));
      setOpenCreateModal(false);
      form.reset(defaultValues);
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao criar anima.");
      }
    }
  };

  const openAnimaModal = (anima: BestiaryAnima, tab: "details" | "edit" = "details") => {
    setSelectedAnimaId(anima.id);
    setSelectedTab(tab);
    if (tab === "edit") {
      loadEditForm(anima);
    }
  };

  const handleUpdate = async (values: BestiaryFormValues) => {
    if (!selectedAnima) return;
    try {
      await updateBestiaryAnima(selectedAnima.id, toPayload(values));
      await fetchData();
      setSelectedTab("details");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao editar anima.");
      }
    }
  };

  const handleDelete = async (anima: BestiaryAnima) => {
    if (!window.confirm(`Excluir o inimigo "${anima.name}" do bestiario?`)) {
      return;
    }

    setDeletingId(anima.id);
    try {
      await deleteBestiaryAnima(anima.id);
      if (selectedAnimaId === anima.id) {
        setSelectedAnimaId(null);
      }
      await fetchData();
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

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bestiario</h1>
          <p className="text-sm text-muted-foreground">Gerencie inimigos em cards com detalhes, drops e mapas.</p>
        </div>

        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar inimigo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>Novo inimigo</DialogTitle>
              <DialogDescription>Configure status, sprite e drops do inimigo.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(handleCreate)}>
                <AnimaFormFields form={form} drops={createDrops} items={items} />
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Criando..." : "Criar inimigo"}
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
          <CardDescription>Filtre por nome, nivel de poder e mapas onde o inimigo aparece.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Buscar por nome..."
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
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
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={filters.mapId}
            onChange={(event) => setFilters((current) => ({ ...current, mapId: event.target.value }))}
          >
            <option value="ALL">Todos os mapas</option>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedAnima)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAnimaId(null);
            setSelectedTab("details");
            editForm.reset(defaultValues);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          {selectedAnima ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAnima.name}</DialogTitle>
                <DialogDescription>Detalhes completos de combate, drops e presenca em mapas.</DialogDescription>
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
                          <Badge variant="outline">Inversao {invertLabel(selectedAnima.flipHorizontal)}</Badge>
                          <Badge variant="outline">{(mapPresenceByAnima.get(selectedAnima.id) ?? []).length} mapas</Badge>
                          <Badge variant="outline">{selectedAnima.drops.length} drops</Badge>
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
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">Drop Bits</div>
                            <p className="font-semibold">{selectedAnima.bitsDrop}</p>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-2 text-sm">
                            <div className="mb-1 inline-flex items-center gap-1 text-muted-foreground">Drop XP</div>
                            <p className="font-semibold">{selectedAnima.xpDrop}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Drops configurados</p>
                      {selectedAnima.drops.length === 0 ? (
                        <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Sem drops.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {selectedAnima.drops.map((drop) => (
                            <div key={drop.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                {drop.item.imageData ? <img src={drop.item.imageData} alt={drop.item.name} className="h-7 w-7 object-contain" /> : null}
                                <span className="truncate">{drop.item.name}</span>
                              </div>
                              <span className="text-muted-foreground">
                                x{drop.quantity} . {drop.dropChance.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Mapas em que aparece</p>
                      {(mapPresenceByAnima.get(selectedAnima.id) ?? []).length === 0 ? (
                        <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Nao presente em nenhum mapa.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(mapPresenceByAnima.get(selectedAnima.id) ?? []).map((entry) => (
                            <Badge key={`${entry.mapId}-${selectedAnima.id}`} variant="secondary" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {entry.mapName} ({entry.groups})
                            </Badge>
                          ))}
                        </div>
                      )}
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
                      <AnimaFormFields form={editForm} drops={editDrops} items={items} />
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
          <CardTitle>Inimigos</CardTitle>
          <CardDescription>Visualizacao em tabela para edicao e exclusao rapida.</CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && filteredAnimas.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum inimigo encontrado com os filtros atuais.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inimigo</TableHead>
                  <TableHead>Poder</TableHead>
                  <TableHead>ATK/DEF/HP</TableHead>
                  <TableHead>Velocidade</TableHead>
                  <TableHead>Drops</TableHead>
                  <TableHead>Mapas</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimas.map((anima) => {
                  const presence = mapPresenceByAnima.get(anima.id) ?? [];
                  return (
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
                            <p className="text-xs text-muted-foreground">{invertLabel(anima.flipHorizontal)} . {anima.spriteScale.toFixed(1)}x</p>
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{powerLabel(anima.powerLevel)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        ATK {anima.attack} . DEF {anima.defense} . HP {anima.maxHp}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {anima.attackSpeedSeconds.toFixed(2)}s . {anima.critChance.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {anima.drops.length} drops . {anima.bitsDrop} bits . {anima.xpDrop} xp
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{presence.length}</TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

