import crypto from "node:crypto";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";

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

import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from "../services/emailVerificationService.js";

import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../services/emailService.js";
/**
 * Return only safe user information.
 *
 * Passwords and verification tokens must never be included.
 */
const getPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,

  // Profile fields
  department: user.department,
  year: user.year,
  teachingYears:
    user.teachingYears || [],
  profileCompleted:
    user.profileCompleted,

  // Authentication fields
  isEmailVerified:
    user.isEmailVerified,
  isActive: user.isActive,

  teacherApprovalStatus:
    user.teacherApprovalStatus,
  teacherApprovedAt:
    user.teacherApprovedAt,
  teacherRejectionReason:
    user.teacherRejectionReason,

  lastLoginAt:
    user.lastLoginAt,
  createdAt:
    user.createdAt,
  updatedAt:
    user.updatedAt,
});
const isDuplicateKeyError = (error) =>
  error?.code === 11000;

/**
 * Compare two token hashes without leaking timing information.
 */
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

/**
 * Decode and validate the basic refresh-token signature.
 */
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
 * Check whether a user is allowed to create or refresh a session.
 */
const ensureUserCanLogin = (user) => {
  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      "Please verify your email address before logging in"
    );
  }

  if (user.role === USER_ROLES.TEACHER) {
    const hasSupportedApprovalStatus = [
      TEACHER_APPROVAL_STATUSES.PENDING,
      TEACHER_APPROVAL_STATUSES.REJECTED,
      TEACHER_APPROVAL_STATUSES.APPROVED,
    ].includes(user.teacherApprovalStatus);

    if (!hasSupportedApprovalStatus) {
      throw new ApiError(403, "Your teacher account is not available");
    }

    if (
      user.teacherApprovalStatus ===
        TEACHER_APPROVAL_STATUSES.APPROVED &&
      !user.isActive
    ) {
      throw new ApiError(403, "This account has been disabled");
    }

    return;
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      "This account has been disabled"
    );
  }
};

/**
 * Check whether a user may refresh an existing session.
 */
const userCanRefreshSession = (user) => {
  if (!user) {
    return false;
  }

  if (!user.isEmailVerified) {
    return false;
  }

  if (user.role === USER_ROLES.TEACHER) {
    if (
      [
        TEACHER_APPROVAL_STATUSES.PENDING,
        TEACHER_APPROVAL_STATUSES.REJECTED,
      ].includes(user.teacherApprovalStatus)
    ) {
      return true;
    }

    return (
      user.teacherApprovalStatus ===
        TEACHER_APPROVAL_STATUSES.APPROVED &&
      user.isActive
    );
  }

  return user.isActive;
};

/**
 * POST /api/v1/auth/register
 *
 * Public registration allows only student and teacher roles.
 * A session is not created until the email has been verified.
 */
export const register = asyncHandler(
  async (req, res) => {
    const {
      name,
      email,
      password,
      role = USER_ROLES.STUDENT,
    } = req.body;

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const allowedRegistrationRoles = [
      USER_ROLES.STUDENT,
      USER_ROLES.TEACHER,
    ];

    if (!allowedRegistrationRoles.includes(role)) {
      throw new ApiError(
        400,
        "You can only register as a student or teacher"
      );
    }

    const existingUser = await User.exists({
      email: normalizedEmail,
    });

    if (existingUser) {
      throw new ApiError(
        409,
        "An account with this email address already exists"
      );
    }

    const {
      rawToken,
      hashedToken,
      expiresAt,
      expirationMinutes,
    } = createEmailVerificationToken();

    let user;

    try {
      user = await User.create({
        name,
        email: normalizedEmail,
        password,
        role,
        emailVerificationToken: hashedToken,
        emailVerificationExpiresAt: expiresAt,
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

    try {
      await sendVerificationEmail({
        user,
        rawToken,
        expirationMinutes,
      });
    } catch (error) {
      await User.deleteOne({
        _id: user._id,
      });

      throw new ApiError(
        503,
        "Unable to send verification email. Please try registering again"
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Account registered successfully. Please check your email to verify your account.",
      data: {
        user: getPublicUser(user),
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

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
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

    ensureUserCanLogin(user);

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

    if (!userCanRefreshSession(user)) {
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
        // The refresh-token cookie must still be cleared.
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
      message:
        "Logged out from all devices successfully",
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
 * Allows the authenticated user to log out another selected device.
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
      message:
        "Device session revoked successfully",
      data: null,
    });
  }
);

/**
 * POST /api/v1/auth/verify-email
 */
export const verifyEmail = asyncHandler(
  async (req, res) => {
    const { token } = req.body;

    if (
      typeof token !== "string" ||
      !token.trim()
    ) {
      throw new ApiError(
        400,
        "Verification token is required"
      );
    }

    const hashedToken =
      hashEmailVerificationToken(
        token.trim()
      );

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpiresAt: {
        $gt: new Date(),
      },
    }).select(
      "+emailVerificationToken +emailVerificationExpiresAt"
    );

    if (!user) {
      throw new ApiError(
        400,
        "Verification link is invalid or has expired"
      );
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message:
          "Email address is already verified",
        data: {
          user: getPublicUser(user),
        },
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;

    if (user.role === USER_ROLES.STUDENT) {
      user.isActive = true;
    }

    if (user.role === USER_ROLES.TEACHER) {
      user.isActive = false;
    }

    await user.save({
      validateBeforeSave: false,
    });

    if (user.role === USER_ROLES.STUDENT) {
      try {
        await sendWelcomeEmail(user);
      } catch (error) {
        console.error(
          `Welcome email failed for ${user.email}: ${error.message}`
        );
      }
    }

    const message =
      user.role === USER_ROLES.TEACHER
        ? "Email verified successfully. Sign in to complete your teacher profile."
        : "Email verified successfully. Your account is now active.";

    return res.status(200).json({
      success: true,
      message,
      data: {
        user: getPublicUser(user),
      },
    });
  }
);

/**
 * POST /api/v1/auth/resend-verification-email
 */
export const resendVerificationEmail =
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+emailVerificationToken +emailVerificationExpiresAt"
    );

    const genericResponse = {
      success: true,
      message:
        "If an unverified account exists for this email, a new verification email has been sent.",
      data: null,
    };

    if (!user || user.isEmailVerified) {
      return res
        .status(200)
        .json(genericResponse);
    }

    const {
      rawToken,
      hashedToken,
      expiresAt,
      expirationMinutes,
    } = createEmailVerificationToken();

    user.emailVerificationToken =
      hashedToken;

    user.emailVerificationExpiresAt =
      expiresAt;

    await user.save({
      validateBeforeSave: false,
    });

    try {
      await sendVerificationEmail({
        user,
        rawToken,
        expirationMinutes,
      });
    } catch (error) {
      console.error(
        `Verification resend failed for ${user.email}: ${error.message}`
      );

      throw new ApiError(
        503,
        "Unable to send verification email right now"
      );
    }

    return res
      .status(200)
      .json(genericResponse);
  });
