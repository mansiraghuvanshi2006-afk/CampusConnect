import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api/v1";

const ACCESS_TOKEN_KEY = "campus_connect_access_token";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem(
      ACCESS_TOKEN_KEY
    );

    if (accessToken) {
      config.headers.Authorization =
        `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
        }
      )
      .then((response) => {
        const newAccessToken =
          response.data?.data?.accessToken;

        if (!newAccessToken) {
          throw new Error(
            "Access token was not returned"
          );
        }

        localStorage.setItem(
          ACCESS_TOKEN_KEY,
          newAccessToken
        );

        return newAccessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const isUnauthorized =
      error.response?.status === 401;

    const isRefreshRequest =
      originalRequest?.url?.includes(
        "/auth/refresh"
      );

    if (
      isUnauthorized &&
      !originalRequest?._retry &&
      !isRefreshRequest
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken =
          await refreshAccessToken();

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch {
        localStorage.removeItem(
          ACCESS_TOKEN_KEY
        );

        window.dispatchEvent(
          new Event("auth:unauthorized")
        );
      }
    }

    return Promise.reject(error);
  }
);

export { ACCESS_TOKEN_KEY };
export default api;