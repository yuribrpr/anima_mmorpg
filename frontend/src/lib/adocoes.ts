import { apiRequest } from "@/lib/api";
import type { AdoptAnimaInput, AdoptedAnima, AdoptionCandidate, AdoptionEvolutionChain } from "@/types/adocao";

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

export const unlockAdoptedAnimaEvolution = async (id: string) => {
  const response = await apiRequest<{ unlocked: true; anima: AdoptedAnima }>(`/adocoes/${id}/evolucoes/desbloquear`, {
    method: "PATCH",
  });

  window.dispatchEvent(new CustomEvent("adoption:changed"));
  return response.anima;
};

export const evolveAdoptedAnima = async (id: string) => {
  const response = await apiRequest<{ evolved: true; anima: AdoptedAnima }>(`/adocoes/${id}/evolucoes/evoluir`, {
    method: "POST",
  });

  window.dispatchEvent(new CustomEvent("adoption:changed"));
  return response.anima;
};

export const regressAdoptedAnima = async (id: string) => {
  const response = await apiRequest<{ regressed: true; anima: AdoptedAnima }>(`/adocoes/${id}/evolucoes/regredir`, {
    method: "POST",
  });

  window.dispatchEvent(new CustomEvent("adoption:changed"));
  return response.anima;
};

export const getAdoptedAnimaEvolutionChain = async (id: string) => {
  return apiRequest<AdoptionEvolutionChain>(`/adocoes/${id}/evolucoes/cadeia`, {
    method: "GET",
  });
};
