import { useEffect, useMemo, useState } from "react";
import { Edit, MessageSquare, Plus, Trash2, Users } from "lucide-react";
import { listBestiaryAnimas } from "@/lib/bestiario";
import { ApiError } from "@/lib/api";
import { createNpc, deleteNpc, listNpcs, updateNpc } from "@/lib/npcs";
import { listItems } from "@/lib/itens";
import type { BestiaryAnima } from "@/types/bestiary-anima";
import type { Item } from "@/types/item";
import type {
  CreateNpcDefinitionInput,
  NpcDefinition,
  NpcDialog,
  NpcDialogActionType,
  QuestTemplate,
} from "@/types/npc";
import { ImageCropFlipField } from "@/components/common/ImageCropFlipField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const uid = (prefix: string) =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}_${crypto.randomUUID().slice(0, 8)}`
    : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const emptyQuest = (): QuestTemplate => ({
  questType: "SUB",
  title: "",
  description: "",
  talkToNpcId: null,
  talkToNpcName: null,
  rewardBits: 0,
  rewardXp: 0,
  rewardItems: [],
  killObjectives: [],
  dropObjectives: [],
});

const emptyDialog = (): NpcDialog => ({
  id: uid("dialog"),
  text: "",
  actionType: "NONE",
  quest: null,
  buyOffers: [],
  craftRecipes: [],
});

const emptyDraft = () => ({ name: "", imageData: null as string | null, dialogs: [emptyDialog()] });
type Draft = ReturnType<typeof emptyDraft>;

const actionLabel = (action: NpcDialogActionType) =>
  action === "QUEST" ? "Quest" : action === "SHOP_BUY" ? "Lojinha (Bits)" : action === "SHOP_CRAFT" ? "Craft" : "Somente dialogo";

const normalizeDraft = (npc: NpcDefinition): Draft => ({
  name: npc.name,
  imageData: npc.imageData,
  dialogs:
    npc.dialogs.length > 0
      ? npc.dialogs.map((dialog) => ({
          ...dialog,
          quest:
            dialog.actionType === "QUEST"
              ? dialog.quest
                ? {
                    ...dialog.quest,
                    questType: dialog.quest.questType ?? "SUB",
                    rewardBits: Math.max(0, Math.floor(dialog.quest.rewardBits ?? 0)),
                    rewardXp: Math.max(0, Math.floor(dialog.quest.rewardXp ?? 0)),
                    rewardItems: dialog.quest.rewardItems ?? [],
                  }
                : emptyQuest()
              : null,
          buyOffers: dialog.actionType === "SHOP_BUY" ? dialog.buyOffers : [],
          craftRecipes:
            dialog.actionType === "SHOP_CRAFT"
              ? dialog.craftRecipes.map((recipe) => ({
                  ...recipe,
                  requirements: recipe.requirements.length > 0 ? recipe.requirements : [{ itemId: "", itemName: null, quantity: 1 }],
                }))
              : [],
        }))
      : [emptyDialog()],
});

export const AdminNpcsPage = () => {
  const [npcs, setNpcs] = useState<NpcDefinition[]>([]);
  const [bestiary, setBestiary] = useState<BestiaryAnima[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openEditor, setOpenEditor] = useState(false);
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const npcNameById = useMemo(() => new Map(npcs.map((entry) => [entry.id, entry.name])), [npcs]);
  const bestiaryNameById = useMemo(() => new Map(bestiary.map((entry) => [entry.id, entry.name])), [bestiary]);
  const itemNameById = useMemo(() => new Map(items.map((entry) => [entry.id, entry.name])), [items]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [npcsResult, bestiaryResult, itemsResult] = await Promise.allSettled([listNpcs(), listBestiaryAnimas(), listItems()]);
      setNpcs(npcsResult.status === "fulfilled" ? npcsResult.value : []);
      setBestiary(bestiaryResult.status === "fulfilled" ? bestiaryResult.value : []);
      setItems(itemsResult.status === "fulfilled" ? itemsResult.value : []);
      if (npcsResult.status === "rejected") {
        setErrorMessage("Nao foi possivel listar NPCs existentes agora. Tente novamente em instantes.");
      } else if (bestiaryResult.status === "rejected" || itemsResult.status === "rejected") {
        setErrorMessage("NPCs carregados, mas alguns catalogos auxiliares falharam.");
      } else {
        setErrorMessage(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Falha ao carregar NPCs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return npcs
      .filter((npc) => (query ? npc.name.toLowerCase().includes(query) : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [npcs, search]);

  const updateDialog = (dialogId: string, updater: (dialog: NpcDialog) => NpcDialog) => {
    setDraft((current) => ({ ...current, dialogs: current.dialogs.map((dialog) => (dialog.id === dialogId ? updater(dialog) : dialog)) }));
  };

  const validate = () => {
    if (!draft.name.trim()) return "Informe o nome do NPC.";
    for (const dialog of draft.dialogs) {
      if (dialog.actionType === "QUEST" && !dialog.text.trim()) return "Dialogs de quest precisam de texto.";
      if (dialog.actionType === "QUEST") {
        const quest = dialog.quest;
        if (!quest || !quest.title.trim() || !quest.description.trim()) return "Quest precisa de titulo e descricao.";
        for (const reward of quest.rewardItems) {
          if (!reward.itemId.trim()) return "Toda recompensa de item precisa de um item selecionado.";
          if (reward.quantity < 1) return "Quantidade da recompensa deve ser maior que zero.";
        }
        const hasTalk = Boolean(quest.talkToNpcId);
        const hasKill = quest.killObjectives.some((objective) => objective.bestiaryAnimaId.trim().length > 0);
        const hasDrop = quest.dropObjectives.some((objective) => objective.itemId.trim().length > 0);
        if (!hasTalk && !hasKill && !hasDrop) return "Cada quest precisa de pelo menos um objetivo.";
      }
      if (dialog.actionType === "SHOP_BUY" && dialog.buyOffers.length === 0) return "Adicione ao menos uma oferta na lojinha.";
      if (dialog.actionType === "SHOP_BUY") {
        for (const offer of dialog.buyOffers) {
          if (!offer.itemId.trim()) return "Toda oferta da lojinha precisa de item.";
          if (offer.quantity < 1) return "Quantidade da oferta deve ser maior que zero.";
          if (offer.bitsCost < 0) return "Custo em bits da oferta nao pode ser negativo.";
        }
      }

      if (dialog.actionType === "SHOP_CRAFT" && dialog.craftRecipes.length === 0) return "Adicione ao menos uma receita de craft.";
      if (dialog.actionType === "SHOP_CRAFT") {
        for (const recipe of dialog.craftRecipes) {
          if (!recipe.resultItemId.trim()) return "Toda receita precisa de item de resultado.";
          if (recipe.resultQuantity < 1) return "Quantidade de resultado da receita deve ser maior que zero.";
          if (recipe.requirements.length === 0) return "Toda receita precisa de ao menos um requisito.";
          for (const requirement of recipe.requirements) {
            if (!requirement.itemId.trim()) return "Todo requisito de craft precisa de item.";
            if (requirement.quantity < 1) return "Quantidade do requisito deve ser maior que zero.";
          }
        }
      }
    }
    return null;
  };

  const toPayload = (): CreateNpcDefinitionInput => ({
    name: draft.name.trim(),
    imageData: draft.imageData,
    dialogs: draft.dialogs.map((dialog) => ({
      id: dialog.id,
      text: dialog.text.trim(),
      actionType: dialog.actionType,
      quest:
        dialog.actionType === "QUEST" && dialog.quest
          ? {
              questType: dialog.quest.questType ?? "SUB",
              title: dialog.quest.title.trim(),
              description: dialog.quest.description.trim(),
              talkToNpcId: dialog.quest.talkToNpcId || null,
              talkToNpcName: dialog.quest.talkToNpcId ? npcNameById.get(dialog.quest.talkToNpcId) ?? null : null,
              rewardBits: Math.max(0, Math.floor(dialog.quest.rewardBits || 0)),
              rewardXp: Math.max(0, Math.floor(dialog.quest.rewardXp || 0)),
              rewardItems: dialog.quest.rewardItems
                .filter((reward) => reward.itemId.trim().length > 0)
                .map((reward) => ({
                  id: reward.id,
                  itemId: reward.itemId,
                  itemName: itemNameById.get(reward.itemId) ?? null,
                  quantity: Math.max(1, Math.floor(reward.quantity || 1)),
                })),
              killObjectives: dialog.quest.killObjectives
                .filter((objective) => objective.bestiaryAnimaId.trim().length > 0)
                .map((objective) => ({
                  id: objective.id,
                  bestiaryAnimaId: objective.bestiaryAnimaId,
                  bestiaryName: bestiaryNameById.get(objective.bestiaryAnimaId) ?? null,
                  quantity: Math.max(1, Math.floor(objective.quantity || 1)),
                })),
              dropObjectives: dialog.quest.dropObjectives
                .filter((objective) => objective.itemId.trim().length > 0)
                .map((objective) => ({
                  id: objective.id,
                  itemId: objective.itemId,
                  itemName: itemNameById.get(objective.itemId) ?? null,
                  quantity: Math.max(1, Math.floor(objective.quantity || 1)),
                })),
            }
          : null,
      buyOffers:
        dialog.actionType === "SHOP_BUY"
          ? dialog.buyOffers.map((offer) => ({
              id: offer.id,
              itemId: offer.itemId,
              itemName: itemNameById.get(offer.itemId) ?? null,
              description: offer.description.trim(),
              quantity: Math.max(1, Math.floor(offer.quantity || 1)),
              bitsCost: Math.max(0, Math.floor(offer.bitsCost || 0)),
            }))
          : [],
      craftRecipes:
        dialog.actionType === "SHOP_CRAFT"
          ? dialog.craftRecipes.map((recipe) => ({
              id: recipe.id,
              resultItemId: recipe.resultItemId,
              resultItemName: itemNameById.get(recipe.resultItemId) ?? null,
              description: recipe.description.trim(),
              resultQuantity: Math.max(1, Math.floor(recipe.resultQuantity || 1)),
              requirements: recipe.requirements.map((requirement) => ({
                itemId: requirement.itemId,
                itemName: itemNameById.get(requirement.itemId) ?? null,
                quantity: Math.max(1, Math.floor(requirement.quantity || 1)),
              })),
            }))
          : [],
    })),
  });

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const payload = toPayload();
      if (editingNpcId) await updateNpc(editingNpcId, payload);
      else await createNpc(payload);
      setOpenEditor(false);
      setEditingNpcId(null);
      setDraft(emptyDraft());
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Falha ao salvar NPC.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeNpc = async (npc: NpcDefinition) => {
    if (!window.confirm(`Excluir NPC ${npc.name}?`)) return;
    setDeletingId(npc.id);
    try {
      await deleteNpc(npc.id);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Falha ao excluir NPC.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin de NPCs</h1>
          <p className="text-sm text-muted-foreground">Criacao visual de dialogos, quests, lojinha e craft.</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditingNpcId(null);
            setDraft(emptyDraft());
            setOpenEditor(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Novo NPC
        </Button>
      </header>

      {errorMessage ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            NPCs cadastrados
          </CardTitle>
          <CardDescription>Use a busca para encontrar e editar rapidamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Buscar por nome..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {!loading && filtered.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum NPC encontrado.</div>
            ) : null}
            {filtered.map((npc) => (
              <Card key={npc.id} className="bg-card/70">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    {npc.imageData ? <img src={npc.imageData} alt={npc.name} className="h-16 w-16 rounded-md border object-cover" /> : <div className="h-16 w-16 rounded-md border bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{npc.name}</p>
                      <p className="text-xs text-muted-foreground">{npc.dialogs.length} dialogos</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {npc.dialogs.slice(0, 3).map((dialog) => (
                          <Badge key={dialog.id} variant="secondary" className="text-[10px]">
                            {actionLabel(dialog.actionType)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="flex-1" variant="outline" onClick={() => { setEditingNpcId(npc.id); setDraft(normalizeDraft(npc)); setOpenEditor(true); }}>
                      <Edit className="mr-1 h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="destructive" onClick={() => void removeNpc(npc)} disabled={deletingId === npc.id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={openEditor}
        onOpenChange={(open) => {
          setOpenEditor(open);
          if (!open) {
            setEditingNpcId(null);
            setDraft(emptyDraft());
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editingNpcId ? "Editar NPC" : "Novo NPC"}</DialogTitle>
            <DialogDescription>Editor visual sem campos JSON.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
            <Card className="h-fit">
              <CardHeader className="pb-3"><CardTitle className="text-base">Dados do NPC</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do NPC" />
                </div>
                <ImageCropFlipField value={draft.imageData} onChange={(imageData) => setDraft((current) => ({ ...current, imageData }))} label="Imagem do NPC" enableFlip={false} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              {draft.dialogs.map((dialog, index) => (
                <Card key={dialog.id}>
                  <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Dialogo {index + 1}</CardTitle><Badge variant="secondary">{actionLabel(dialog.actionType)}</Badge></div></CardHeader>
                  <CardContent className="space-y-3">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={dialog.actionType} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, actionType: event.target.value as NpcDialogActionType, quest: event.target.value === "QUEST" ? current.quest ?? emptyQuest() : null, buyOffers: event.target.value === "SHOP_BUY" ? current.buyOffers.length ? current.buyOffers : [{ id: uid("offer"), itemId: "", itemName: null, description: "", quantity: 1, bitsCost: 0 }] : [], craftRecipes: event.target.value === "SHOP_CRAFT" ? current.craftRecipes.length ? current.craftRecipes : [{ id: uid("recipe"), resultItemId: "", resultItemName: null, description: "", resultQuantity: 1, requirements: [{ itemId: "", itemName: null, quantity: 1 }] }] : [] }))}>
                      <option value="NONE">Somente dialogo</option>
                      <option value="QUEST">Quest</option>
                      <option value="SHOP_BUY">Lojinha (Itens por Bits)</option>
                      <option value="SHOP_CRAFT">Craft (Itens por Itens)</option>
                    </select>

                    {dialog.actionType === "QUEST" ? (
                      <textarea
                        className="min-h-[86px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Fala do NPC para esta quest..."
                        value={dialog.text}
                        onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, text: event.target.value }))}
                      />
                    ) : null}

                    {dialog.actionType === "SHOP_BUY" || dialog.actionType === "SHOP_CRAFT" ? (
                      <p className="rounded-md border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                        Sem dialogo: esta acao abre direto no menu de interacao com o NPC.
                      </p>
                    ) : null}

                    {dialog.actionType === "QUEST" && dialog.quest ? (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={dialog.quest.questType ?? "SUB"}
                          onChange={(event) =>
                            updateDialog(dialog.id, (current) => ({
                              ...current,
                              quest: current.quest ? { ...current.quest, questType: event.target.value as QuestTemplate["questType"] } : null,
                            }))
                          }
                        >
                          <option value="MAIN">Main Quest (Roxa)</option>
                          <option value="SUB">Subquest (Amarela)</option>
                          <option value="DAILY">Daily Quest (Azul)</option>
                          <option value="REPEATABLE">Repetivel (Verde)</option>
                        </select>
                        <Input placeholder="Titulo da quest" value={dialog.quest.title} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, title: event.target.value } : null }))} />
                        <textarea className="min-h-[78px] w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={560} placeholder="Descricao da quest" value={dialog.quest.description} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, description: event.target.value } : null }))} />
                        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={dialog.quest.talkToNpcId ?? ""} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, talkToNpcId: event.target.value || null, talkToNpcName: event.target.value ? npcNameById.get(event.target.value) ?? null : null } : null }))}>
                          <option value="">Sem objetivo de conversa</option>
                          {npcs.map((npc) => (<option key={npc.id} value={npc.id}>{npc.name}</option>))}
                        </select>
                        <div className="space-y-2 rounded-md border border-emerald-400/20 bg-emerald-500/10 p-2.5">
                          <p className="text-xs font-medium text-emerald-100">Recompensas da quest</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              type="number"
                              min={0}
                              placeholder="Bits"
                              value={dialog.quest.rewardBits}
                              onChange={(event) =>
                                updateDialog(dialog.id, (current) => ({
                                  ...current,
                                  quest: current.quest
                                    ? { ...current.quest, rewardBits: Math.max(0, Math.floor(Number(event.target.value) || 0)) }
                                    : null,
                                }))
                              }
                            />
                            <Input
                              type="number"
                              min={0}
                              placeholder="XP"
                              value={dialog.quest.rewardXp}
                              onChange={(event) =>
                                updateDialog(dialog.id, (current) => ({
                                  ...current,
                                  quest: current.quest
                                    ? { ...current.quest, rewardXp: Math.max(0, Math.floor(Number(event.target.value) || 0)) }
                                    : null,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">Itens de recompensa</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateDialog(dialog.id, (current) => ({
                                    ...current,
                                    quest: current.quest
                                      ? {
                                          ...current.quest,
                                          rewardItems: [...current.quest.rewardItems, { id: uid("reward"), itemId: "", itemName: null, quantity: 1 }],
                                        }
                                      : null,
                                  }))
                                }
                              >
                                Adicionar
                              </Button>
                            </div>
                            {dialog.quest.rewardItems.length === 0 ? <p className="text-[11px] text-muted-foreground">Sem itens de recompensa.</p> : null}
                            {dialog.quest.rewardItems.map((reward) => (
                              <div key={reward.id} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                                <select
                                  className="h-9 rounded-md border bg-background px-3 text-sm"
                                  value={reward.itemId}
                                  onChange={(event) =>
                                    updateDialog(dialog.id, (current) => ({
                                      ...current,
                                      quest: current.quest
                                        ? {
                                            ...current.quest,
                                            rewardItems: current.quest.rewardItems.map((entry) =>
                                              entry.id === reward.id
                                                ? { ...entry, itemId: event.target.value, itemName: itemNameById.get(event.target.value) ?? null }
                                                : entry,
                                            ),
                                          }
                                        : null,
                                    }))
                                  }
                                >
                                  <option value="">Selecione item</option>
                                  {items.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                      {entry.name}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  type="number"
                                  min={1}
                                  max={9999}
                                  value={reward.quantity}
                                  onChange={(event) =>
                                    updateDialog(dialog.id, (current) => ({
                                      ...current,
                                      quest: current.quest
                                        ? {
                                            ...current.quest,
                                            rewardItems: current.quest.rewardItems.map((entry) =>
                                              entry.id === reward.id
                                                ? { ...entry, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) }
                                                : entry,
                                            ),
                                          }
                                        : null,
                                    }))
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    updateDialog(dialog.id, (current) => ({
                                      ...current,
                                      quest: current.quest
                                        ? { ...current.quest, rewardItems: current.quest.rewardItems.filter((entry) => entry.id !== reward.id) }
                                        : null,
                                    }))
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between"><p className="text-xs font-medium">Objetivos de matar</p><Button size="sm" variant="outline" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, killObjectives: [...current.quest.killObjectives, { id: uid("kill"), bestiaryAnimaId: "", bestiaryName: null, quantity: 1 }] } : null }))}>Adicionar</Button></div>
                          {dialog.quest.killObjectives.map((objective) => (
                            <div key={objective.id} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={objective.bestiaryAnimaId} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, killObjectives: current.quest.killObjectives.map((entry) => entry.id === objective.id ? { ...entry, bestiaryAnimaId: event.target.value, bestiaryName: bestiaryNameById.get(event.target.value) ?? null } : entry) } : null }))}>
                                <option value="">Selecione no bestiario</option>
                                {bestiary.map((entry) => (<option key={entry.id} value={entry.id}>{entry.name}</option>))}
                              </select>
                              <Input type="number" min={1} max={9999} value={objective.quantity} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, killObjectives: current.quest.killObjectives.map((entry) => entry.id === objective.id ? { ...entry, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : entry) } : null }))} />
                              <Button variant="ghost" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, killObjectives: current.quest.killObjectives.filter((entry) => entry.id !== objective.id) } : null }))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between"><p className="text-xs font-medium">Objetivos de drop</p><Button size="sm" variant="outline" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, dropObjectives: [...current.quest.dropObjectives, { id: uid("drop"), itemId: "", itemName: null, quantity: 1 }] } : null }))}>Adicionar</Button></div>
                          {dialog.quest.dropObjectives.map((objective) => (
                            <div key={objective.id} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={objective.itemId} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, dropObjectives: current.quest.dropObjectives.map((entry) => entry.id === objective.id ? { ...entry, itemId: event.target.value, itemName: itemNameById.get(event.target.value) ?? null } : entry) } : null }))}>
                                <option value="">Selecione item</option>
                                {items.map((entry) => (<option key={entry.id} value={entry.id}>{entry.name}</option>))}
                              </select>
                              <Input type="number" min={1} max={9999} value={objective.quantity} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, dropObjectives: current.quest.dropObjectives.map((entry) => entry.id === objective.id ? { ...entry, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : entry) } : null }))} />
                              <Button variant="ghost" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, quest: current.quest ? { ...current.quest, dropObjectives: current.quest.dropObjectives.filter((entry) => entry.id !== objective.id) } : null }))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {dialog.actionType === "SHOP_BUY" ? (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                        <div className="flex items-center justify-between"><p className="text-xs font-medium">Ofertas</p><Button size="sm" variant="outline" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, buyOffers: [...current.buyOffers, { id: uid("offer"), itemId: "", itemName: null, description: "", quantity: 1, bitsCost: 0 }] }))}>Adicionar</Button></div>
                        {dialog.buyOffers.map((offer) => (
                          <div key={offer.id} className="grid gap-2 rounded-md border bg-card/70 p-2 md:grid-cols-[1fr_1fr_110px_120px_auto]">
                            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={offer.itemId} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, buyOffers: current.buyOffers.map((entry) => entry.id === offer.id ? { ...entry, itemId: event.target.value, itemName: itemNameById.get(event.target.value) ?? null } : entry) }))}>
                              <option value="">Item</option>
                              {items.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
                            </select>
                            <Input placeholder="Descricao" value={offer.description} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, buyOffers: current.buyOffers.map((entry) => entry.id === offer.id ? { ...entry, description: event.target.value } : entry) }))} />
                            <Input type="number" min={1} value={offer.quantity} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, buyOffers: current.buyOffers.map((entry) => entry.id === offer.id ? { ...entry, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : entry) }))} />
                            <Input type="number" min={0} value={offer.bitsCost} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, buyOffers: current.buyOffers.map((entry) => entry.id === offer.id ? { ...entry, bitsCost: Math.max(0, Math.floor(Number(event.target.value) || 0)) } : entry) }))} />
                            <Button variant="ghost" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, buyOffers: current.buyOffers.filter((entry) => entry.id !== offer.id) }))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {dialog.actionType === "SHOP_CRAFT" ? (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                        <div className="flex items-center justify-between"><p className="text-xs font-medium">Receitas</p><Button size="sm" variant="outline" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: [...current.craftRecipes, { id: uid("recipe"), resultItemId: "", resultItemName: null, description: "", resultQuantity: 1, requirements: [{ itemId: "", itemName: null, quantity: 1 }] }] }))}>Adicionar</Button></div>
                        {dialog.craftRecipes.map((recipe) => (
                          <div key={recipe.id} className="space-y-2 rounded-md border bg-card/70 p-2">
                            <div className="grid gap-2 md:grid-cols-[1fr_110px_auto]">
                              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={recipe.resultItemId} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, resultItemId: event.target.value, resultItemName: itemNameById.get(event.target.value) ?? null } : entry) }))}>
                                <option value="">Resultado</option>
                                {items.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
                              </select>
                              <Input type="number" min={1} value={recipe.resultQuantity} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, resultQuantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : entry) }))} />
                              <Button variant="ghost" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.filter((entry) => entry.id !== recipe.id) }))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <Input placeholder="Descricao da receita" value={recipe.description} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, description: event.target.value } : entry) }))} />
                            <div className="space-y-1">
                              <div className="flex items-center justify-between"><p className="text-xs font-medium">Requisitos</p><Button size="sm" variant="outline" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, requirements: [...entry.requirements, { itemId: "", itemName: null, quantity: 1 }] } : entry) }))}>Adicionar</Button></div>
                              {recipe.requirements.map((requirement, reqIndex) => (
                                <div key={`${recipe.id}_${reqIndex}`} className="grid gap-2 md:grid-cols-[1fr_110px_auto]">
                                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={requirement.itemId} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, requirements: entry.requirements.map((req, idx) => idx === reqIndex ? { ...req, itemId: event.target.value, itemName: itemNameById.get(event.target.value) ?? null } : req) } : entry) }))}>
                                    <option value="">Item requerido</option>
                                    {items.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
                                  </select>
                                  <Input type="number" min={1} value={requirement.quantity} onChange={(event) => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, requirements: entry.requirements.map((req, idx) => idx === reqIndex ? { ...req, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : req) } : entry) }))} />
                                  <Button variant="ghost" onClick={() => updateDialog(dialog.id, (current) => ({ ...current, craftRecipes: current.craftRecipes.map((entry) => entry.id === recipe.id ? { ...entry, requirements: entry.requirements.length <= 1 ? entry.requirements : entry.requirements.filter((_, idx) => idx !== reqIndex) } : entry) }))}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, dialogs: current.dialogs.length <= 1 ? current.dialogs : current.dialogs.filter((entry) => entry.id !== dialog.id) }))}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remover dialogo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" className="w-full" onClick={() => setDraft((current) => ({ ...current, dialogs: [...current.dialogs, emptyDialog()] }))}>
                <MessageSquare className="mr-1 h-4 w-4" />
                Adicionar dialogo
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditor(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar NPC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
