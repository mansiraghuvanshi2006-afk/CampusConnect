import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../services/tokenService.js";

const authenticate = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    throw new ApiError(
      401,
      "Authentication required. Please provide an access token"
    );
  }

  const accessToken = authorizationHeader.split(" ")[1];

  if (!accessToken) {
    throw new ApiError(401, "Access token is missing");
  }

  const payload = verifyAccessToken(accessToken);

  if (
    payload.tokenType !== "access" ||
    typeof payload.userId !== "string"
  ) {
    throw new ApiError(401, "Invalid access token");
  }

  const user = await User.findById(payload.userId);

  if (!user) {
    throw new ApiError(
      401,
      "The user associated with this token no longer exists"
    );
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      "This account has been disabled"
    );
  }

  req.user = user;

  next();
});

export default authenticate;