import { apiRequest } from "@/lib/api";
import type { GlobalSettings, UpdateGlobalSettingsInput } from "@/types/global-settings";

export const getGlobalSettings = async () => {
  const response = await apiRequest<{ settings: GlobalSettings }>("/variaveis-globais", {
    method: "GET",
  });

  return response.settings;
};

export const updateGlobalSettings = async (input: UpdateGlobalSettingsInput) => {
  const response = await apiRequest<{ settings: GlobalSettings }>("/variaveis-globais", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return response.settings;
};
