import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  changeMyPassword,
  getMySettings,
  logoutAllMyDevices,
  updateMySettings,
} from "../services/settingsService.js";
import { clearAllAiHistory } from "../services/aiService.js";

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getMySettings(req.user._id);

  return sendSuccess(res, 200, "Settings loaded", { settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await updateMySettings(req.user._id, req.body);

  return sendSuccess(res, 200, "Settings updated", { settings });
});

export const changePassword = asyncHandler(async (req, res) => {
  await changeMyPassword(req.user, req.body);

  return sendSuccess(
    res,
    200,
    "Password changed successfully. Please sign in again on all devices.",
    {}
  );
});

export const logoutAllDevices = asyncHandler(async (req, res) => {
  await logoutAllMyDevices(req.user, res);

  return sendSuccess(
    res,
    200,
    "Logged out from all devices",
    {}
  );
});

export const clearAiHistoryFromSettings = asyncHandler(
  async (req, res) => {
    const result = await clearAllAiHistory(req.user);

    return sendSuccess(res, 200, "AI history cleared", result);
  }
);
