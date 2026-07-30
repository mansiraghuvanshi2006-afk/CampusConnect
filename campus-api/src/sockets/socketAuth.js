import User from "../models/User.js";
import { verifyAccessToken } from "../services/tokenService.js";
import { canUseChat } from "../services/chatPolicyService.js";

/**
 * Authenticate a Socket.IO handshake using the access JWT.
 */
const socketAuth = async (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;

    const headerToken = socket.handshake.headers
      ?.authorization;

    let token = authToken;

    if (
      !token &&
      typeof headerToken === "string" &&
      headerToken.startsWith("Bearer ")
    ) {
      token = headerToken.slice(7);
    }

    if (!token) {
      return next(
        new Error("Authentication required")
      );
    }

    const payload = verifyAccessToken(token);

    if (
      !payload?.userId ||
      payload.tokenType !== "access"
    ) {
      return next(
        new Error("Invalid access token")
      );
    }

    const user = await User.findById(payload.userId);

    if (!user) {
      return next(new Error("User not found"));
    }

    if (user.mustChangePassword) {
      return next(
        new Error(
          "Please change your temporary password before using chat"
        )
      );
    }

    const access = canUseChat(user);

    if (!access.allowed) {
      return next(new Error(access.message));
    }

    socket.user = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      year: user.year,
      teachingYears: user.teachingYears,
      isEmailVerified: user.isEmailVerified,
      profileCompleted: user.profileCompleted,
      teacherApprovalStatus: user.teacherApprovalStatus,
      isActive: user.isActive,
      lastSeenAt: user.lastSeenAt,
    };

    return next();
  } catch (error) {
    return next(
      new Error(
        error.message || "Socket authentication failed"
      )
    );
  }
};

export default socketAuth;
