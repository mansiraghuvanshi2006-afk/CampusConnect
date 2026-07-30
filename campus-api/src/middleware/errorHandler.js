const errorHandler = (error, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  } else if (error?.statusCode >= 500 || !error?.statusCode) {
    console.error({
      message: error?.message,
      statusCode: error?.statusCode,
      code: error?.code,
      path: req.originalUrl,
    });
  }

  // MongoDB duplicate-key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || "field";

    return res.status(409).json({
      success: false,
      message: `An account with this ${field} already exists`,
      errors: [],
    });
  }

  // Mongoose validation error
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Invalid MongoDB ObjectId
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid resource identifier",
      errors: [],
    });
  }

  // Multer / upload errors
  if (error.name === "MulterError") {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the maximum allowed size"
        : error.code === "LIMIT_FILE_COUNT"
          ? "Too many files uploaded"
          : "File upload failed";

    return res.status(400).json({
      success: false,
      message,
      errors: [],
    });
  }

  // JWT errors
  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    return res.status(401).json({
      success: false,
      message:
        error.name === "TokenExpiredError"
          ? "Access token has expired"
          : "Invalid access token",
      errors: [],
    });
  }

  // CORS rejection from origin callback
  if (error?.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
      errors: [],
    });
  }

  const statusCode = error.statusCode || 500;
  const details = Array.isArray(error.details)
    ? error.details
    : error.details
      ? [error.details]
      : [];

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
    errors: details,
    ...(typeof error.code === "string" && {
      code: error.code,
    }),
    ...(process.env.NODE_ENV !== "production" &&
      statusCode >= 500 && {
        stack: error.stack,
      }),
  });
};

export default errorHandler;
