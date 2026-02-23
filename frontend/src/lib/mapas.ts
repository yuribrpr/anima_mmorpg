import { apiRequest } from "@/lib/api";
import type { ActiveMapPayload, EnemyPresence, GameMap, GameMapListItem, MapAssetsPayload, MapLayoutPayload, PlayerMapState, PlayerPresence } from "@/types/mapa";

export const getActiveMap = async () => {
  return apiRequest<ActiveMapPayload>("/mapas/ativo", {
    method: "GET",
  });
};

export const updateActiveState = async (payload: Pick<PlayerMapState, "tileX" | "tileY" | "scaleX" | "scaleY">) => {
  const response = await apiRequest<{ state: PlayerMapState }>("/mapas/ativo/estado", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.state;
};

export const usePortal = async (portalId: string) => {
  return apiRequest<ActiveMapPayload>("/mapas/teleportar", {
    method: "POST",
    body: JSON.stringify({ portalId }),
  });
};

export const listActivePlayers = async () => {
  const response = await apiRequest<{ players: PlayerPresence[] }>("/mapas/ativo/jogadores", {
    method: "GET",
  });

  return response.players;
};

export const listActiveEnemies = async () => {
  const response = await apiRequest<{ enemies: EnemyPresence[] }>("/mapas/ativo/inimigos", {
    method: "GET",
  });

  return response.enemies;
};

export const listMaps = async () => {
  const response = await apiRequest<{ maps: GameMapListItem[] }>("/mapas", {
    method: "GET",
  });

  return response.maps;
};

export const createMap = async (name: string) => {
  const response = await apiRequest<{ map: GameMap }>("/mapas", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

  return response.map;
};

export const renameMap = async (id: string, name: string) => {
  const response = await apiRequest<{ map: GameMap }>(`/mapas/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

  return response.map;
};

export const deleteMap = async (id: string) => {
  await apiRequest<void>(`/mapas/${id}`, {
    method: "DELETE",
  });
};

export const getMapById = async (id: string) => {
  const response = await apiRequest<{ map: GameMap }>(`/mapas/${id}`, {
    method: "GET",
  });

  return response.map;
};

export const saveMapLayout = async (id: string, payload: MapLayoutPayload) => {
  const response = await apiRequest<{ map: GameMap }>(`/mapas/${id}/layout`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.map;
};

export const saveMapAssets = async (id: string, payload: MapAssetsPayload) => {
  const response = await apiRequest<{ map: GameMap }>(`/mapas/${id}/assets`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.map;
};

export const activateMap = async (id: string) => {
  const response = await apiRequest<{ map: GameMap }>(`/mapas/${id}/ativar`, {
    method: "PATCH",
  });

  return response.map;
};
