import ApiError from "../utils/ApiError.js";

export const PASSWORD_CHANGE_REQUIRED_CODE =
  "PASSWORD_CHANGE_REQUIRED";

/**
 * Block protected resources while an admin-created user still
 * holds their temporary password.
 *
 * Mount this after `authenticate` on feature routers. The auth
 * router is intentionally left unguarded so logout, the current
 * user endpoint, token refresh and the temporary-password change
 * endpoint keep working.
 */
const requirePasswordChange = (req, res, next) => {
  if (!req.user?.mustChangePassword) {
    return next();
  }

  const error = new ApiError(
    403,
    "Please change your temporary password before continuing"
  );

  error.code = PASSWORD_CHANGE_REQUIRED_CODE;

  return next(error);
};

export default requirePasswordChange;
