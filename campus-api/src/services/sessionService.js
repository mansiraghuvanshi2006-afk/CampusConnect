import Session from "../models/Session.js";

import {
  generateAccessToken,
  generateRefreshToken,
  generateSessionId,
  hashToken,
} from "./tokenService.js";

import {
  getRefreshTokenDurationMs,
} from "../utils/tokenDuration.js";

const getDeviceName = (userAgent = "") => {
  const normalizedUserAgent =
    userAgent.toLowerCase();

  if (
    normalizedUserAgent.includes("android")
  ) {
    return "Android device";
  }

  if (
    normalizedUserAgent.includes("iphone") ||
    normalizedUserAgent.includes("ipad")
  ) {
    return "iOS device";
  }

  if (
    normalizedUserAgent.includes("windows")
  ) {
    return "Windows computer";
  }

  if (
    normalizedUserAgent.includes("macintosh") ||
    normalizedUserAgent.includes("mac os")
  ) {
    return "Mac computer";
  }

  if (
    normalizedUserAgent.includes("linux")
  ) {
    return "Linux computer";
  }

  return "Unknown device";
};

const createSessionExpirationDate = () => {
  return new Date(
    Date.now() + getRefreshTokenDurationMs()
  );
};

export const createUserSession = async (
  user,
  req
) => {
  const sessionId = generateSessionId();

  const accessToken =
    generateAccessToken(user);

  const refreshToken =
    generateRefreshToken(user, sessionId);

  const userAgent =
    req.get("user-agent") || "Unknown device";

  const session = await Session.create({
    user: user._id,
    sessionId,
    refreshTokenHash: hashToken(refreshToken),
    deviceName: getDeviceName(userAgent),
    userAgent,
    ipAddress: req.ip || null,
    lastUsedAt: new Date(),
    expiresAt: createSessionExpirationDate(),
  });

  return {
    accessToken,
    refreshToken,
    session,
  };
};

export const rotateUserSession = async (
  user,
  session
) => {
  const accessToken =
    generateAccessToken(user);

  const refreshToken =
    generateRefreshToken(
      user,
      session.sessionId
    );

  session.refreshTokenHash =
    hashToken(refreshToken);

  session.lastUsedAt = new Date();

  session.expiresAt =
    createSessionExpirationDate();

  await session.save();

  return {
    accessToken,
    refreshToken,
  };
};