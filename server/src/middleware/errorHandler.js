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

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'That request is too large. Shorten the text and try again.';
  } else if (err.name === 'ValidationError') {
    status = 400;
    // Replace Mongoose's technical enum/cast wording with plain messages.
    const friendly = (path, v) => {
      if (v.kind === 'enum') return `Choose a valid ${path.split('.').pop()}.`;
      if (v.name === 'CastError') return `Enter a valid value for ${path.split('.').pop()}.`;
      return v.message;
    };
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, friendly(k, v)]));
    message = Object.values(details)[0];
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message =
      field === 'slug'
        ? 'A listing with this name and stock number already exists. Change the stock number.'
        : field === 'email'
          ? 'An account with that email already exists. Log in instead.'
          : `That ${field} is already in use.`;
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message, ...(details && { details }) });
}

module.exports = { notFound, errorHandler };
