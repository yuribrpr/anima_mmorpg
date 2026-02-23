import { apiRequest } from "@/lib/api";
import type {
  ActiveMapNpc,
  CreateNpcDefinitionInput,
  DeliverNpcQuestResult,
  NpcDefinition,
  PlayerQuest,
  RegisterEnemyDefeatResult,
  UpdateNpcDefinitionInput,
} from "@/types/npc";

export const listNpcs = async () => {
  const response = await apiRequest<{ npcs: NpcDefinition[] }>("/npcs", {
    method: "GET",
  });

  return response.npcs;
};

export const createNpc = async (input: CreateNpcDefinitionInput) => {
  const response = await apiRequest<{ npc: NpcDefinition }>("/npcs", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.npc;
};

export const updateNpc = async (id: string, input: UpdateNpcDefinitionInput) => {
  const response = await apiRequest<{ npc: NpcDefinition }>(`/npcs/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return response.npc;
};

export const deleteNpc = async (id: string) => {
  await apiRequest<void>(`/npcs/${id}`, {
    method: "DELETE",
  });
};

export const listActiveMapNpcs = async () => {
  const response = await apiRequest<{ npcs: ActiveMapNpc[] }>("/npcs/mapa-ativo", {
    method: "GET",
  });

  return response.npcs;
};

export const listPlayerQuests = async () => {
  return apiRequest<{ activeQuests: PlayerQuest[]; completedQuests: PlayerQuest[] }>("/npcs/quests", {
    method: "GET",
  });
};

export const acceptNpcQuest = async (npcId: string, dialogId: string) => {
  const response = await apiRequest<{
    accepted: boolean;
    reason: string | null;
    quest: PlayerQuest;
    activeQuests: PlayerQuest[];
  }>("/npcs/quests/aceitar", {
    method: "POST",
    body: JSON.stringify({ npcId, dialogId }),
  });

  window.dispatchEvent(new CustomEvent("quest:changed"));
  return response;
};

export const deliverNpcQuest = async (npcId: string, questId: string) => {
  const response = await apiRequest<DeliverNpcQuestResult>("/npcs/quests/entregar", {
    method: "POST",
    body: JSON.stringify({ npcId, questId }),
  });

  window.dispatchEvent(new CustomEvent("quest:changed"));
  window.dispatchEvent(new CustomEvent("inventory:changed"));
  window.dispatchEvent(new CustomEvent("adoption:changed"));
  return response;
};

export const registerNpcTalk = async (npcId: string) => {
  const response = await apiRequest<{ activeQuests: PlayerQuest[] }>("/npcs/eventos/falar", {
    method: "POST",
    body: JSON.stringify({ npcId }),
  });

  window.dispatchEvent(new CustomEvent("quest:changed"));
  return response;
};

export const registerEnemyDefeat = async (payload: { bestiaryAnimaId: string; droppedItems: Array<{ itemId: string; quantity: number }> }) => {
  const response = await apiRequest<RegisterEnemyDefeatResult>("/npcs/eventos/inimigo-derrotado", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  window.dispatchEvent(new CustomEvent("inventory:changed"));
  window.dispatchEvent(new CustomEvent("quest:changed"));
  window.dispatchEvent(new CustomEvent("adoption:changed"));
  return response;
};

export const buyFromNpc = async (payload: { npcId: string; dialogId: string; offerId: string; quantity?: number }) => {
  const response = await apiRequest<{ bought: true; bits: number; itemId: string; quantity: number }>("/npcs/loja/comprar", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  window.dispatchEvent(new CustomEvent("inventory:changed"));
  return response;
};

export const craftAtNpc = async (payload: { npcId: string; dialogId: string; recipeId: string; quantity?: number }) => {
  const response = await apiRequest<{ crafted: true; bits: number; itemId: string; quantity: number }>("/npcs/loja/craftar", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  window.dispatchEvent(new CustomEvent("inventory:changed"));
  return response;
};
