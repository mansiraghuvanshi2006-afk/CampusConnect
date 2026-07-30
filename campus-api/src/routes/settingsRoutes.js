import express from "express";

import {
  changePassword,
  clearAiHistoryFromSettings,
  getSettings,
  logoutAllDevices,
  updateSettings,
} from "../controllers/settingsController.js";

import authenticate from "../middleware/authenticate.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  changePasswordSchema,
  updateSettingsSchema,
} from "../validators/settingsValidators.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange);

router.get("/", getSettings);

router.patch(
  "/",
  validateRequest(updateSettingsSchema),
  updateSettings
);

router.post(
  "/change-password",
  validateRequest(changePasswordSchema),
  changePassword
);

router.post("/logout-all", logoutAllDevices);

router.delete("/ai-history", clearAiHistoryFromSettings);

export default router;
