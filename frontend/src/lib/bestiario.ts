import { apiRequest } from "@/lib/api";
import type { BestiaryAnima, CreateBestiaryAnimaInput, UpdateBestiaryAnimaInput } from "@/types/bestiary-anima";

export const listBestiaryAnimas = async () => {
  const response = await apiRequest<{ animas: BestiaryAnima[] }>("/bestiario", {
    method: "GET",
  });

  return response.animas;
};

export const createBestiaryAnima = async (input: CreateBestiaryAnimaInput) => {
  const response = await apiRequest<{ anima: BestiaryAnima }>("/bestiario", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.anima;
};

export const updateBestiaryAnima = async (id: string, input: UpdateBestiaryAnimaInput) => {
  const response = await apiRequest<{ anima: BestiaryAnima }>(`/bestiario/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return response.anima;
};
