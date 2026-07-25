const validateParams = (schema) => {
    return (req, res, next) => {
      const result = schema.safeParse(req.params);
  
      if (!result.success) {
        const errors = result.error.issues.map(
          (issue) => ({
            field: issue.path.join(".") || "params",
            message: issue.message,
          })
        );
  
        return res.status(400).json({
          success: false,
          message: "Route parameter validation failed",
          errors,
        });
      }
  
      req.params = result.data;
  
      next();
    };
  };
  
  export default validateParams;