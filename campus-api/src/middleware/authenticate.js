import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";
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

  const user = await User.findById(payload.userId).populate(
    "department",
    "name code isActive"
  );

  if (!user) {
    throw new ApiError(
      401,
      "The user associated with this token no longer exists"
    );
  }

  const tokenVersion = Number(payload.tokenVersion) || 0;
  const currentVersion = Number(user.tokenVersion) || 0;

  if (tokenVersion !== currentVersion) {
    throw new ApiError(
      401,
      "Access token has been revoked. Please sign in again"
    );
  }

  const isLimitedTeacher =
    user.role === USER_ROLES.TEACHER &&
    user.isEmailVerified &&
    [
      TEACHER_APPROVAL_STATUSES.PENDING,
      TEACHER_APPROVAL_STATUSES.REJECTED,
    ].includes(user.teacherApprovalStatus);

  if (!user.isActive && !isLimitedTeacher) {
    throw new ApiError(
      403,
      "This account has been disabled"
    );
  }

  req.user = user;

  next();
});

export default authenticate;
