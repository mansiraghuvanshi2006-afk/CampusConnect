import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import profileOptionRoutes from "./routes/profileOptionRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";

import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import { UPLOAD_ROOT } from "./middleware/uploadMiddleware.js";
import { corsOriginDelegate } from "./utils/corsOrigins.js";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// Security middleware — allow cross-origin media for chat attachments
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS — allowlist only (never reflect arbitrary origins)
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
  })
);

// Request logging — verbose in development only
if (process.env.NODE_ENV === "production") {
  app.use(
    morgan("combined", {
      skip: (req) => req.url === "/api/v1/health",
    })
  );
} else {
  app.use(morgan("dev"));
}

// JSON body parsing
app.use(
  express.json({
    limit: "64kb",
  })
);

// Form body parsing
app.use(
  express.urlencoded({
    extended: false,
    limit: "10kb",
  })
);

// Cookie parsing
app.use(cookieParser());

// Static chat uploads (validated at write time)
app.use(
  "/uploads",
  express.static(UPLOAD_ROOT, {
    fallthrough: true,
    maxAge: "7d",
  })
);

// Health routes
app.use("/api/v1/health", healthRoutes);

// Authentication routes
app.use("/api/v1/auth", authRoutes);

// Profile routes
app.use("/api/v1/profile", profileRoutes);

// Active departments and academic years used during profile setup
app.use("/api/v1/profile-options", profileOptionRoutes);

// Admin routes
app.use("/api/v1/admin", adminRoutes);

// Campus chat routes
app.use("/api/v1/chat", chatRoutes);

// Campus AI (separate from human chat)
app.use("/api/v1/ai", aiRoutes);

// Account settings
app.use("/api/v1/settings", settingsRoutes);

// Public contact form
app.use("/api/v1/contact", contactRoutes);

// Handle unknown routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
