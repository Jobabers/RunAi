class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function assertCondition(condition, statusCode, message, details = null) {
  if (!condition) {
    throw new HttpError(statusCode, message, details);
  }
}

module.exports = {
  HttpError,
  assertCondition,
};
