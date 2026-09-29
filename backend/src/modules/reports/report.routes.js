'use strict';

const express = require('express');
const {
  createReportController,
} = require('./report.controller');

function createReportRouter(options = {}) {
  const router = express.Router({
    mergeParams: true,
  });
  const controller =
    createReportController(options);

  router.get('/', controller.summary);

  return router;
}

module.exports = {
  createReportRouter,
};
