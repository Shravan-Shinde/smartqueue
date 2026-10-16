/**
 * 404 API Not Found Handler Middleware
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API Route Not Found - [${req.method}] ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
};

module.exports = notFoundHandler;
