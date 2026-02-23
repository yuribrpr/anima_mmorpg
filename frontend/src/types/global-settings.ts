export type GlobalSettings = {
  id: string;
  expMultiplier: number;
  bitsMultiplier: number;
  createdAt: string;
  updatedAt: string;
};

export type UpdateGlobalSettingsInput = {
  expMultiplier: number;
  bitsMultiplier: number;
};
