const errorHandler = (error, req, res, next) => {
  console.error(error);

  // MongoDB duplicate-key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || "field";

    return res.status(409).json({
      success: false,
      message: `An account with this ${field} already exists`,
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
    });
  }

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
    ...(error.details && { errors: error.details }),
    ...(process.env.NODE_ENV !== "production" && {
      stack: error.stack,
    }),
  });
};

export default errorHandler;