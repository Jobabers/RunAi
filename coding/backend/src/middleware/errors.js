const { HttpError } = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'ไม่พบ API ที่ร้องขอ'));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = err.statusCode || 500;
  const payload = {
    error: {
      message: statusCode === 500 ? 'เกิดข้อผิดพลาดภายในระบบ' : err.message,
    },
  };

  if (err.details) {
    payload.error.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    payload.error.debug = err.message;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  errorHandler,
  notFound,
};
