import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Request logging
app.use(morgan("dev"));

// JSON body parsing
app.use(
  express.json({
    limit: "10kb",
  })
);

// Form body parsing
app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb",
  })
);

// Cookie parsing
app.use(cookieParser());

// Health routes
app.use(
  "/api/v1/health",
  healthRoutes
);

// Authentication routes
app.use(
  "/api/v1/auth",
  authRoutes
);

// Profile routes
app.use(
  "/api/v1/profile",
  profileRoutes
);

// Admin routes
app.use(
  "/api/v1/admin",
  adminRoutes
);

// Handle unknown routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;