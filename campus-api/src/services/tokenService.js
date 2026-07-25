import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import ApiError from "../utils/ApiError.js";

const getRequiredEnvironmentVariable = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
};

export const generateSessionId = () => {
  return uuidv4();
};

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      tokenType: "access",
    },
    getRequiredEnvironmentVariable("JWT_ACCESS_SECRET"),
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
      issuer: "campus-connect-api",
      audience: "campus-connect-client",
    }
  );
};

export const generateRefreshToken = (user, sessionId) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      sessionId,
      tokenType: "refresh",
    },
    getRequiredEnvironmentVariable("JWT_REFRESH_SECRET"),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      issuer: "campus-connect-api",
      audience: "campus-connect-client",
    }
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(
      token,
      getRequiredEnvironmentVariable("JWT_ACCESS_SECRET"),
      {
        issuer: "campus-connect-api",
        audience: "campus-connect-client",
      }
    );
  } catch {
    throw new ApiError(401, "Access token is invalid or expired");
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(
      token,
      getRequiredEnvironmentVariable("JWT_REFRESH_SECRET"),
      {
        issuer: "campus-connect-api",
        audience: "campus-connect-client",
      }
    );
  } catch {
    throw new ApiError(401, "Refresh token is invalid or expired");
  }
};

export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};