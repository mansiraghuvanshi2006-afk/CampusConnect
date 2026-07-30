import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api/v1";

const ACCESS_TOKEN_KEY = "campus_connect_access_token";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    config.headers = config.headers || {};

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Let the browser set multipart boundaries for FormData.
    if (config.data instanceof FormData) {
      if (typeof config.headers.set === "function") {
        config.headers.delete("Content-Type");
      } else {
        delete config.headers["Content-Type"];
      }
    } else if (
      config.data &&
      typeof config.data === "object" &&
      !config.headers["Content-Type"]
    ) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;
let unauthorizedDispatched = false;

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
        const newAccessToken = response.data?.data?.accessToken;

        if (!newAccessToken) {
          throw new Error("Access token was not returned");
        }

        localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
        unauthorizedDispatched = false;

        window.dispatchEvent(
          new CustomEvent("auth:token-refreshed", {
            detail: {
              accessToken: newAccessToken,
            },
          })
        );

        return newAccessToken;
      })
      .catch((error) => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);

        if (!unauthorizedDispatched) {
          unauthorizedDispatched = true;
          window.dispatchEvent(new Event("auth:unauthorized"));
        }

        throw error;
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

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (axios.isCancel?.(error) || error.code === "ERR_CANCELED") {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response?.status === 401;

    const isRefreshRequest = String(originalRequest.url || "").includes(
      "/auth/refresh"
    );

    if (
      isUnauthorized &&
      !originalRequest._retry &&
      !isRefreshRequest
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { ACCESS_TOKEN_KEY };
export default api;
