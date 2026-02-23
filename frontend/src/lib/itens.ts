import { apiRequest } from "@/lib/api";
import type { CreateItemInput, Item, ItemGalleryEntry, UpdateItemInput } from "@/types/item";

export const listItems = async () => {
  const response = await apiRequest<{ items: Item[] }>("/itens", {
    method: "GET",
  });
  return response.items;
};

export const listItemGallery = async () => {
  const response = await apiRequest<{ gallery: ItemGalleryEntry[] }>("/itens/galeria", {
    method: "GET",
  });
  return response.gallery;
};

export const createItem = async (input: CreateItemInput) => {
  const response = await apiRequest<{ item: Item }>("/itens", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.item;
};

export const updateItem = async (id: string, input: UpdateItemInput) => {
  const response = await apiRequest<{ item: Item }>(`/itens/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return response.item;
};

export const deleteItem = async (id: string) => {
  await apiRequest<void>(`/itens/${id}`, {
    method: "DELETE",
  });
};
