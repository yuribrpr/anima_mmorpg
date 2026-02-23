import { ApiError, apiRequest } from "@/lib/api";
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

export const deleteBestiaryAnima = async (id: string) => {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new ApiError(400, "BESTIARY_ANIMA_ID_REQUIRED", "Bestiary anima id is required");
  }

  const encodedId = encodeURIComponent(normalizedId);
  try {
    await apiRequest<void>(`/bestiario/${encodedId}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === "NOT_FOUND") {
      await apiRequest<void>(`/bestiario?id=${encodedId}`, {
        method: "DELETE",
      });
      return;
    }
    throw error;
  }
};
