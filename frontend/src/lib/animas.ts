import { apiRequest } from "@/lib/api";
import type { Anima, CreateAnimaInput, UpdateAnimaInput } from "@/types/anima";

export const listAnimas = async () => {
  const response = await apiRequest<{ animas: Anima[] }>("/animas", {
    method: "GET",
  });

  return response.animas;
};

export const createAnima = async (input: CreateAnimaInput) => {
  const response = await apiRequest<{ anima: Anima }>("/animas", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.anima;
};

export const updateAnima = async (id: string, input: UpdateAnimaInput) => {
  const response = await apiRequest<{ anima: Anima }>(`/animas/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return response.anima;
};

export const deleteAnima = async (id: string) => {
  await apiRequest<void>(`/animas/${id}`, {
    method: "DELETE",
  });
};
