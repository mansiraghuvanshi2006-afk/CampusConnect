/**
 * Ensure required env vars exist for importing the Express app in tests.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  "test_access_secret_phase4_finalize";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "test_refresh_secret_phase4_finalize";
process.env.CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";
process.env.EMAIL_HOST = process.env.EMAIL_HOST || "localhost";
process.env.EMAIL_PORT = process.env.EMAIL_PORT || "587";
process.env.EMAIL_USER = process.env.EMAIL_USER || "test@campus.test";
process.env.EMAIL_PASSWORD =
  process.env.EMAIL_PASSWORD || "test-password";
process.env.EMAIL_FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS || "CampusConnect <test@campus.test>";
process.env.EMAIL_FROM_NAME =
  process.env.EMAIL_FROM_NAME || "CampusConnect";
