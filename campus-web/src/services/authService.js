import api, {
  ACCESS_TOKEN_KEY,
} from "./api.js";

export const loginUser = async ({
  email,
  password,
}) => {
  const response = await api.post(
    "/auth/login",
    {
      email,
      password,
    }
  );

  const accessToken =
    response.data?.data?.accessToken;

  if (!accessToken) {
    throw new Error(
      "Access token was not returned"
    );
  }

  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    accessToken
  );

  return response.data.data;
};

export const registerUser = async (
  userData
) => {
  const response = await api.post(
    "/auth/register",
    userData
  );

  return response.data;
};

export const verifyEmail = async (
  token
) => {
  const response = await api.post(
    "/auth/verify-email",
    {
      token,
    }
  );

  return response.data;
};

export const resendVerificationEmail =
  async (email) => {
    const response = await api.post(
      "/auth/resend-verification",
      {
        email,
      }
    );

    return response.data;
  };

export const getCurrentUser = async () => {
  const response = await api.get(
    "/auth/me"
  );

  return response.data.data.user;
};

/**
 * Replace the temporary password assigned by an administrator.
 *
 * The current session stays valid, so the caller only needs to
 * refresh the stored user state afterwards.
 */
export const changeTemporaryPassword = async ({
  currentPassword,
  newPassword,
  confirmPassword,
}) => {
  const response = await api.patch(
    "/auth/change-temporary-password",
    {
      currentPassword,
      newPassword,
      confirmPassword,
    }
  );

  return response.data?.data?.user;
};

export const logoutUser = async () => {
  try {
    const response = await api.post(
      "/auth/logout"
    );

    return response.data;
  } finally {
    localStorage.removeItem(
      ACCESS_TOKEN_KEY
    );
  }
};