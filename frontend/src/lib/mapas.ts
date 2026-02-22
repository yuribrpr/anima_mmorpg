import { apiRequest } from "@/lib/api";
import type { ActiveMapPayload, GameMap, GameMapListItem, MapAssetsPayload, MapLayoutPayload, PlayerMapState } from "@/types/mapa";

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
