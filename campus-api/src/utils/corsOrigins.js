/**
 * Shared CORS origin allowlist for Express and Socket.IO.
 *
 * CLIENT_URL may be a single origin or a comma-separated list.
 * Requests without an Origin header are allowed (server tools / tests).
 * Arbitrary origins are never reflected.
 */

const parseAllowedOrigins = () => {
  const raw =
    process.env.CLIENT_URL || "http://localhost:5173";

  return [
    ...new Set(
      raw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  ];
};

export const getAllowedOrigins = () => parseAllowedOrigins();

export const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
};

/**
 * Express cors() origin callback.
 */
export const corsOriginDelegate = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("Not allowed by CORS"));
};

/**
 * Socket.IO cors.origin option — return the request origin
 * only when it is allowlisted, otherwise false.
 */
export const socketCorsOrigin = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (getAllowedOrigins().includes(origin)) {
    callback(null, origin);
    return;
  }

  callback(new Error("Not allowed by CORS"));
};
