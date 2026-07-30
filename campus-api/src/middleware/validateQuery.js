const validateQuery = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Query validation failed",
        errors,
      });
    }

    // Express 5 makes req.query a getter-only property.
    req.validatedQuery = result.data;

    next();
  };
};

export default validateQuery;
