const DATABASE_UNAVAILABLE_ERRORS = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerClosedError",
  "MongoServerSelectionError",
  "MongoWaitQueueTimeoutError",
  "MongooseServerSelectionError",
]);

let lastDatabaseErrorLogAt = 0;

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (DATABASE_UNAVAILABLE_ERRORS.has(err?.name)) {
    const now = Date.now();
    if (now - lastDatabaseErrorLogAt >= 10_000) {
      lastDatabaseErrorLogAt = now;
      console.error("Database temporarily unavailable", err);
    }
    res.set("Retry-After", "1");
    return res.status(503).json({ message: "Service temporarily unavailable" });
  }

  console.error(err);
  const status = err.status || 500;
  const message = err.status ? err.message || "Something went wrong" : "Something went wrong";
  res.status(status).json({ message });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
