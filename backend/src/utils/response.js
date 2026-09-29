'use strict';

function sendSuccess(res, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

function sendList(res, items, nextCursor = null, status = 200) {
  return sendSuccess(
    res,
    {
      items,
      nextCursor,
    },
    status,
  );
}

function sendError(res, error) {
  return res.status(error.httpStatus).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  });
}

module.exports = {
  sendSuccess,
  sendList,
  sendError,
};
