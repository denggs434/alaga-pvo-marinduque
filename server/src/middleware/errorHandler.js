/**
 * Central error handling. Turns thrown errors (including Mongoose
 * validation and duplicate-key errors) into consistent JSON responses:
 *   { message: string, details?: object }
 */
function notFound(req, res) {
  res.status(404).json({ message: `No API route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong on the server.';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = Object.values(details)[0];
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `That ${field} is already in use.`;
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message, ...(details && { details }) });
}

module.exports = { notFound, errorHandler };
