// Central error handler — keep route handlers thin, throw or next(err) from them.
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.isJoi) {
    return res.status(400).json({ error: "Validation error", details: err.details });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Internal server error" : err.message;

  res.status(status).json({ error: message });
}

function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

module.exports = { errorHandler, notFound };
