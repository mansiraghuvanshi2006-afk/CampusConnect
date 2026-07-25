import express from "express";

import {
  getActiveSessions,
  getCurrentUser,
  login,
  logout,
  logoutAllDevices,
  refreshAccessToken,
  register,
  revokeSession,
} from "../controllers/authController.js";

import authenticate from "../middleware/authenticate.js";
import validateRequest from "../middleware/validateRequest.js";
import validateParams from "../middleware/validateParams.js";

import {
  loginSchema,
  registerSchema,
  sessionIdParamsSchema,
} from "../validators/authValidators.js";

const router = express.Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  register
);

router.post(
  "/login",
  validateRequest(loginSchema),
  login
);

router.post(
  "/refresh",
  refreshAccessToken
);

router.post(
  "/logout",
  logout
);

router.get(
  "/me",
  authenticate,
  getCurrentUser
);

router.get(
  "/sessions",
  authenticate,
  getActiveSessions
);

router.delete(
  "/sessions/:sessionId",
  authenticate,
  validateParams(sessionIdParamsSchema),
  revokeSession
);

router.post(
  "/logout-all",
  authenticate,
  logoutAllDevices
);

export default router;