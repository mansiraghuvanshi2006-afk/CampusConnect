const notFound = (req, res, next) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      error: "NOT_FOUND",
    });
  };
  
  export default notFound;