import { apiRequest } from "@/lib/api";
import type { AdoptAnimaInput, AdoptedAnima, AdoptionCandidate } from "@/types/adocao";

export const listAdoptionCandidates = async () => {
  const response = await apiRequest<{ animas: AdoptionCandidate[] }>("/adocoes/candidatos", {
    method: "GET",
  });

  return response.animas;
};

export const adoptAnima = async (input: AdoptAnimaInput) => {
  const response = await apiRequest<{ anima: AdoptedAnima }>("/adocoes", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.anima;
};

export const listAdoptedAnimas = async () => {
  const response = await apiRequest<{ animas: AdoptedAnima[] }>("/adocoes", {
    method: "GET",
  });

  return response.animas;
};

export const setPrimaryAdoptedAnima = async (id: string) => {
  const response = await apiRequest<{ anima: AdoptedAnima }>(`/adocoes/${id}/principal`, {
    method: "PATCH",
  });

  return response.anima;
};
