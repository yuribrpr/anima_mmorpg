import { apiRequest } from "@/lib/api";
import type { InventoryItemLayout, UseInventoryItemResult, UserInventory } from "@/types/inventario";

export const getUserInventory = async () => {
  const response = await apiRequest<{ inventory: UserInventory }>("/inventario", {
    method: "GET",
  });

  return response.inventory;
};

export const updateInventoryLayout = async (layout: InventoryItemLayout[]) => {
  const response = await apiRequest<{ inventory: UserInventory }>("/inventario/layout", {
    method: "PATCH",
    body: JSON.stringify({ layout }),
  });

  return response.inventory;
};

export const updateInventoryHotbar = async (hotbar: Array<string | null>) => {
  const response = await apiRequest<{ inventory: UserInventory }>("/inventario/hotbar", {
    method: "PATCH",
    body: JSON.stringify({ hotbar }),
  });

  return response.inventory;
};

export const collectInventoryDrop = async (itemId: string, quantity: number) => {
  const response = await apiRequest<{ inventory: UserInventory }>("/inventario/coletar-drop", {
    method: "POST",
    body: JSON.stringify({ itemId, quantity }),
  });

  window.dispatchEvent(new CustomEvent("inventory:changed"));
  return response.inventory;
};

export const useInventoryItem = async (itemId: string, quantity = 1) => {
  const response = await apiRequest<UseInventoryItemResult>("/inventario/usar", {
    method: "POST",
    body: JSON.stringify({ itemId, quantity }),
  });

  window.dispatchEvent(new CustomEvent("inventory:changed"));
  return response;
};
