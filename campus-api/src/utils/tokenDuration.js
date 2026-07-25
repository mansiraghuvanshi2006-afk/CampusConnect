const DEFAULT_REFRESH_TOKEN_DURATION_MS =
  7 * 24 * 60 * 60 * 1000;

const durationMultipliers = {
  s: 1_000,
  m: 60_000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export const parseDurationToMilliseconds = (
  duration,
  fallbackMilliseconds
) => {
  if (typeof duration !== "string") {
    return fallbackMilliseconds;
  }

  const normalizedDuration = duration
    .trim()
    .toLowerCase();

  const match = /^(\d+)([smhdw])$/.exec(
    normalizedDuration
  );

  if (!match) {
    return fallbackMilliseconds;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    return fallbackMilliseconds;
  }

  return value * durationMultipliers[unit];
};

export const getRefreshTokenDurationMs = () => {
  return parseDurationToMilliseconds(
    process.env.JWT_REFRESH_EXPIRES_IN,
    DEFAULT_REFRESH_TOKEN_DURATION_MS
  );
};