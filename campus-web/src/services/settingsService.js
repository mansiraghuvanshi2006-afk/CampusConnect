import api from "./api.js";

export const getSettings = async () => {
  const response = await api.get("/settings");
  return response.data?.data?.settings;
};

export const updateSettings = async (payload) => {
  const response = await api.patch("/settings", payload);
  return response.data?.data?.settings;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await api.post("/settings/change-password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};

export const logoutAllDevices = async () => {
  const response = await api.post("/settings/logout-all");
  return response.data;
};

export const clearAiHistoryFromSettings = async () => {
  const response = await api.delete("/settings/ai-history");
  return response.data?.data;
};
