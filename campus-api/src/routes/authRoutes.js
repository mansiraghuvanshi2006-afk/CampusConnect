import express from "express";

import {
  getActiveSessions,
  getCurrentUser,
  login,
  logout,
  logoutAllDevices,
  refreshAccessToken,
  register,
  resendVerificationEmail,
  revokeSession,
  verifyEmail,
} from "../controllers/authController.js";

import authenticate from "../middleware/authenticate.js";
import validateParams from "../middleware/validateParams.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  sessionIdParamsSchema,
  verifyEmailSchema,
} from "../validators/authValidators.js";

const router = express.Router();

/**
 * Public authentication routes
 */

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
  "/verify-email",
  validateRequest(verifyEmailSchema),
  verifyEmail
);

router.post(
  "/resend-verification",
  validateRequest(resendVerificationSchema),
  resendVerificationEmail
);

router.post(
  "/refresh",
  refreshAccessToken
);

router.post(
  "/logout",
  logout
);

/**
 * Protected authentication routes
 */

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