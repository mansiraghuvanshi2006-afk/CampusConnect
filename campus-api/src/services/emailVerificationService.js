import crypto from "node:crypto";

const DEFAULT_EXPIRATION_MINUTES = 30;

const getExpirationMinutes = () => {
  const configuredMinutes =
    Number.parseInt(
      process.env
        .EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES,
      10
    );

  if (
    Number.isInteger(configuredMinutes) &&
    configuredMinutes >= 5 &&
    configuredMinutes <= 1440
  ) {
    return configuredMinutes;
  }

  return DEFAULT_EXPIRATION_MINUTES;
};

export const hashEmailVerificationToken = (
  token
) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

export const createEmailVerificationToken =
  () => {
    const rawToken = crypto
      .randomBytes(32)
      .toString("hex");

    const hashedToken =
      hashEmailVerificationToken(rawToken);

    const expirationMinutes =
      getExpirationMinutes();

    const expiresAt = new Date(
      Date.now() +
        expirationMinutes * 60 * 1000
    );

    return {
      rawToken,
      hashedToken,
      expiresAt,
      expirationMinutes,
    };
  };