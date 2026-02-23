import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { createItem, deleteItem, listItemGallery, listItems, updateItem } from "@/lib/itens";
import type { CreateItemInput, Item, ItemGalleryEntry, ItemType } from "@/types/item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: "CONSUMIVEL", label: "Consumivel" },
  { value: "QUEST", label: "Quest" },
  { value: "NORMAL", label: "Normal" },
];

const itemSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  description: z.string().trim().min(1, "Informe a descricao"),
  type: z.enum(["CONSUMIVEL", "QUEST", "NORMAL"]),
  imageData: z.string().nullable(),
  stackSize: z.number().int().min(1).max(9999),
  healPercentMaxHp: z.number().min(0).max(100),
  bonusAttack: z.number().int().min(0).max(9999),
  bonusDefense: z.number().int().min(0).max(9999),
  bonusMaxHp: z.number().int().min(0).max(999999),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const defaultValues: ItemFormValues = {
  name: "",
  description: "",
  type: "NORMAL",
  imageData: null,
  stackSize: 99,
  healPercentMaxHp: 0,
  bonusAttack: 0,
  bonusDefense: 0,
  bonusMaxHp: 0,
};

const toPayload = (values: ItemFormValues): CreateItemInput => {
  const isConsumable = values.type === "CONSUMIVEL";
  return {
    name: values.name,
    description: values.description,
    type: values.type,
    imageData: values.imageData,
    stackSize: values.stackSize,
    healPercentMaxHp: isConsumable ? values.healPercentMaxHp : 0,
    bonusAttack: isConsumable ? values.bonusAttack : 0,
    bonusDefense: isConsumable ? values.bonusDefense : 0,
    bonusMaxHp: isConsumable ? values.bonusMaxHp : 0,
  };
};

const fileToDataUrl = async (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });

export const AdminItensPage = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [gallery, setGallery] = useState<ItemGalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues,
  });

  const editForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemData, galleryData] = await Promise.all([listItems(), listItemGallery()]);
      setItems(itemData);
      setGallery(galleryData);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao carregar itens.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const openEdit = (item: Item) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      description: item.description,
      type: item.type,
      imageData: item.imageData,
      stackSize: item.stackSize,
      healPercentMaxHp: item.healPercentMaxHp,
      bonusAttack: item.bonusAttack,
      bonusDefense: item.bonusDefense,
      bonusMaxHp: item.bonusMaxHp,
    });
    setEditOpen(true);
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );

  const renderFormBody = (currentForm: ReturnType<typeof useForm<ItemFormValues>>) => {
    const selectedType = currentForm.watch("type");
    const isConsumable = selectedType === "CONSUMIVEL";

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={currentForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Potion+" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={currentForm.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <FormControl>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value as ItemType)}
                  >
                    {ITEM_TYPE_OPTIONS.map((option) => (
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

        <FormField
          control={currentForm.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descricao</FormLabel>
              <FormControl>
                <Input placeholder="Descricao do item" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={currentForm.control}
          name="stackSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stack maximo</FormLabel>
              <FormControl>
                <Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium">Imagem</p>
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) return;
              void fileToDataUrl(file).then((dataUrl) => currentForm.setValue("imageData", dataUrl, { shouldDirty: true }));
              event.currentTarget.value = "";
            }}
          />
          <div className="grid max-h-44 grid-cols-8 gap-2 overflow-y-auto rounded-md border bg-background p-2">
            {gallery.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="rounded border border-border p-1 hover:border-primary"
                title={entry.name}
                onClick={() => currentForm.setValue("imageData", entry.imageUrl, { shouldDirty: true })}
              >
                <img src={entry.imageUrl} alt={entry.name} className="h-8 w-8 object-contain" />
              </button>
            ))}
          </div>
          {currentForm.watch("imageData") ? (
            <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1">
              <img src={currentForm.watch("imageData") ?? ""} alt="Preview" className="h-8 w-8 object-contain" />
              <Button type="button" size="sm" variant="ghost" onClick={() => currentForm.setValue("imageData", null, { shouldDirty: true })}>
                Limpar
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium">Efeitos de consumivel</p>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={currentForm.control}
              name="healPercentMaxHp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recupera HP (% da vida maxima)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={!isConsumable}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={currentForm.control}
              name="bonusAttack"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aumento de ataque</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={!isConsumable}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={currentForm.control}
              name="bonusDefense"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aumento de defesa</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={!isConsumable}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={currentForm.control}
              name="bonusMaxHp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aumento de vida maxima</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={!isConsumable}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleCreate = async (values: ItemFormValues) => {
    try {
      await createItem(toPayload(values));
      setCreateOpen(false);
      form.reset(defaultValues);
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao criar item.");
      }
    }
  };

  const handleUpdate = async (values: ItemFormValues) => {
    if (!editingItem) return;
    try {
      await updateItem(editingItem.id, toPayload(values));
      setEditOpen(false);
      setEditingItem(null);
      editForm.reset(defaultValues);
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao atualizar item.");
      }
    }
  };

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`Excluir item "${item.name}"?`)) {
      return;
    }

    try {
      await deleteItem(item.id);
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Falha ao excluir item.");
      }
    }
  };

  const formatType = (type: ItemType) => ITEM_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Itens</h1>
          <p className="text-sm text-muted-foreground">Cadastro global de itens, efeitos e imagens.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo item</DialogTitle>
              <DialogDescription>Defina os dados base e os efeitos do item.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(handleCreate)}>
                {renderFormBody(form)}
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Criando..." : "Criar item"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>Atualize os dados do item selecionado.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
              {renderFormBody(editForm)}
              <DialogFooter>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Itens</CardTitle>
          <CardDescription>Total: {sortedItems.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Stack</TableHead>
                <TableHead>Efeitos</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum item cadastrado.
                  </TableCell>
                </TableRow>
              ) : null}

              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.imageData ? (
                      <img src={item.imageData} alt={item.name} className="h-10 w-10 rounded border object-contain" />
                    ) : (
                      <div className="h-10 w-10 rounded border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatType(item.type)}</Badge>
                  </TableCell>
                  <TableCell>{item.stackSize}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    HP {item.healPercentMaxHp}% | ATK +{item.bonusAttack} | DEF +{item.bonusDefense} | HPMax +{item.bonusMaxHp}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        <Pencil className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleDelete(item)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
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
