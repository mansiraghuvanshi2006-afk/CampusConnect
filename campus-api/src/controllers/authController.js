import crypto from "node:crypto";

import User from "../models/User.js";
import Session from "../models/Session.js";

import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

import {
  hashToken,
  verifyRefreshToken,
} from "../services/tokenService.js";

import {
  createUserSession,
  rotateUserSession,
} from "../services/sessionService.js";

import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from "../utils/authCookies.js";
const getPublicUser = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
  
  const isDuplicateKeyError = (error) =>
    error?.code === 11000;
  
  const safeHashComparison = (
    firstHash,
    secondHash
  ) => {
    if (
      typeof firstHash !== "string" ||
      typeof secondHash !== "string"
    ) {
      return false;
    }
  
    const firstBuffer = Buffer.from(
      firstHash,
      "utf8"
    );
  
    const secondBuffer = Buffer.from(
      secondHash,
      "utf8"
    );
  
    if (firstBuffer.length !== secondBuffer.length) {
      return false;
    }
  
    return crypto.timingSafeEqual(
      firstBuffer,
      secondBuffer
    );
  };
  
  const decodeRefreshToken = (token) => {
    try {
      return verifyRefreshToken(token);
    } catch {
      throw new ApiError(
        401,
        "Refresh token is invalid or expired"
      );
    }
  };
/**
 * POST /api/v1/auth/register
 */
export const register = asyncHandler(
    async (req, res) => {
      const { name, email, password } = req.body;
  
      const existingUser = await User.exists({
        email,
      });
  
      if (existingUser) {
        throw new ApiError(
          409,
          "An account with this email address already exists"
        );
      }
  
      let user;
  
      try {
        user = await User.create({
          name,
          email,
          password,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ApiError(
            409,
            "An account with this email address already exists"
          );
        }
  
        throw error;
      }
  
      const { accessToken, refreshToken } =
        await createUserSession(user, req);
  
      setRefreshTokenCookie(res, refreshToken);
  
      return res.status(201).json({
        success: true,
        message: "Account registered successfully",
        data: {
          user: getPublicUser(user),
          accessToken,
        },
      });
    }
  );
/**
 * POST /api/v1/auth/login
 */
export const login = asyncHandler(
    async (req, res) => {
      const { email, password } = req.body;
  
      const user = await User.findOne({
        email,
      }).select("+password");
  
      if (!user) {
        throw new ApiError(
          401,
          "Invalid email or password"
        );
      }
  
      const passwordIsCorrect =
        await user.comparePassword(password);
  
      if (!passwordIsCorrect) {
        throw new ApiError(
          401,
          "Invalid email or password"
        );
      }
  
      if (!user.isActive) {
        throw new ApiError(
          403,
          "This account has been disabled"
        );
      }
  
      user.lastLoginAt = new Date();
  
      await user.save({
        validateBeforeSave: false,
      });
  
      const { accessToken, refreshToken } =
        await createUserSession(user, req);
  
      setRefreshTokenCookie(res, refreshToken);
  
      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: getPublicUser(user),
          accessToken,
        },
      });
    }
  );
/**
 * GET /api/v1/auth/me
 */
export const getCurrentUser = asyncHandler(
  async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Current user retrieved successfully",
      data: {
        user: getPublicUser(req.user),
      },
    });
  }
);
/**
 * POST /api/v1/auth/refresh
 */
export const refreshAccessToken = asyncHandler(
    async (req, res) => {
      const incomingRefreshToken =
        getRefreshTokenFromRequest(req);
  
      if (!incomingRefreshToken) {
        throw new ApiError(
          401,
          "Refresh token is missing"
        );
      }
  
      const payload = decodeRefreshToken(
        incomingRefreshToken
      );
  
      if (
        payload.tokenType !== "refresh" ||
        typeof payload.userId !== "string" ||
        typeof payload.sessionId !== "string"
      ) {
        clearRefreshTokenCookie(res);
  
        throw new ApiError(
          401,
          "Invalid refresh token"
        );
      }
  
      const session = await Session.findOne({
        user: payload.userId,
        sessionId: payload.sessionId,
        expiresAt: {
          $gt: new Date(),
        },
      }).select("+refreshTokenHash");
  
      if (!session) {
        clearRefreshTokenCookie(res);
  
        throw new ApiError(
          401,
          "This login session has expired or been revoked"
        );
      }
  
      const incomingTokenHash = hashToken(
        incomingRefreshToken
      );
  
      const tokenMatches = safeHashComparison(
        incomingTokenHash,
        session.refreshTokenHash
      );
  
      if (!tokenMatches) {
        await Session.deleteOne({
          _id: session._id,
        });
  
        clearRefreshTokenCookie(res);
  
        throw new ApiError(
          401,
          "Refresh token has already been used or is invalid"
        );
      }
  
      const user = await User.findById(
        payload.userId
      );
  
      if (!user || !user.isActive) {
        await Session.deleteOne({
          _id: session._id,
        });
  
        clearRefreshTokenCookie(res);
  
        throw new ApiError(
          401,
          "User account is unavailable"
        );
      }
  
      const { accessToken, refreshToken } =
        await rotateUserSession(
          user,
          session,
          req
        );
  
      setRefreshTokenCookie(res, refreshToken);
  
      return res.status(200).json({
        success: true,
        message:
          "Access token refreshed successfully",
        data: {
          accessToken,
        },
      });
    }
  );
/**
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(
    async (req, res) => {
      const incomingRefreshToken =
        getRefreshTokenFromRequest(req);
  
      if (incomingRefreshToken) {
        try {
          const payload = verifyRefreshToken(
            incomingRefreshToken
          );
  
          if (
            typeof payload.userId === "string" &&
            typeof payload.sessionId === "string"
          ) {
            await Session.deleteOne({
              user: payload.userId,
              sessionId: payload.sessionId,
            });
          }
        } catch {
          // Invalid tokens are ignored during logout.
          // The cookie must still be cleared.
        }
      }
  
      clearRefreshTokenCookie(res);
  
      return res.status(200).json({
        success: true,
        message:
          "Logged out from this device successfully",
        data: null,
      });
    }
  );
/**
 * POST /api/v1/auth/logout-all
 *
 * Removes every active session belonging to the user.
 */
export const logoutAllDevices = asyncHandler(
  async (req, res) => {
    await Session.deleteMany({
      user: req.user._id,
    });

    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully",
      data: null,
    });
  }
);
/**
 * GET /api/v1/auth/sessions
 */
export const getActiveSessions = asyncHandler(
    async (req, res) => {
      const sessions = await Session.find({
        user: req.user._id,
        expiresAt: {
          $gt: new Date(),
        },
      })
        .select(
          "sessionId deviceName userAgent ipAddress lastUsedAt createdAt expiresAt"
        )
        .sort({
          lastUsedAt: -1,
        })
        .lean();
  
      return res.status(200).json({
        success: true,
        message:
          "Active sessions retrieved successfully",
        data: {
          sessions,
        },
      });
    }
  );

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 *
 * Allows the user to log out another selected device.
 */
export const revokeSession = asyncHandler(
  async (req, res) => {
    const { sessionId } = req.params;

    const session = await Session.findOneAndDelete({
      sessionId,
      user: req.user._id,
    });

    if (!session) {
      throw new ApiError(
        404,
        "Session was not found or is already logged out"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Device session revoked successfully",
      data: null,
    });
  }
);