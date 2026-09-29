'use strict';

const { sendSuccess } = require('../../utils/response');

function getHealth(req, res) {
  return sendSuccess(res, {
    status: 'ok',
  });
}

module.exports = {
  getHealth,
};
