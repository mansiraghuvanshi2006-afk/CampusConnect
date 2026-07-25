const validateRequest = (schema) => {
    return (req, res, next) => {
      const result = schema.safeParse(req.body);
  
      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        }));
  
        return res.status(400).json({
          success: false,
          message: "Request validation failed",
          errors,
        });
      }
  
      // Replace the original body with cleaned and transformed data.
      req.body = result.data;
  
      next();
    };
  };
  
  export default validateRequest;