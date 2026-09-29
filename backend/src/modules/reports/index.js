'use strict';

const {
  createReportController,
} = require('./report.controller');
const {
  createReportRouter,
} = require('./report.routes');
const {
  PAID_ORDER_STATUSES,
  incrementCount,
  addMoney,
  collectPages,
  createReportService,
} = require('./report.service');

module.exports = {
  createReportController,
  createReportRouter,
  PAID_ORDER_STATUSES,
  incrementCount,
  addMoney,
  collectPages,
  createReportService,
};
