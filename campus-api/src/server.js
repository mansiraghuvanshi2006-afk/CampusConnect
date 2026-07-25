import dns from "node:dns";
import "dotenv/config";
import http from "node:http";

import app from "./app.js";
import connectDB from "./config/database.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const PORT = Number(process.env.PORT) || 5000;

const requiredEnvironmentVariables = [
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const validateEnvironment = () => {
  const missingVariables =
    requiredEnvironmentVariables.filter(
      (variableName) =>
        !process.env[variableName]?.trim()
    );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(
        ", "
      )}`
    );
  }

  if (
    process.env.JWT_ACCESS_SECRET ===
    process.env.JWT_REFRESH_SECRET
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different"
    );
  }
};

const startServer = async () => {
  try {
    validateEnvironment();

    await connectDB();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(
        `CampusConnect API running on port ${PORT}`
      );

      console.log(
        `Health check: http://localhost:${PORT}/api/v1/health`
      );
    });
  } catch (error) {
    console.error(
      `Server startup failed: ${error.message}`
    );

    process.exit(1);
  }
};

startServer();