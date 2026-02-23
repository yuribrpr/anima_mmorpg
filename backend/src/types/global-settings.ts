export type GlobalSettingsOutput = {
  id: string;
  expMultiplier: number;
  bitsMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateGlobalSettingsInput = {
  expMultiplier: number;
  bitsMultiplier: number;
};
