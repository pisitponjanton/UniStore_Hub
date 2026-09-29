'use strict';

const express = require('express');
const {
  createAuditController,
} = require('./audit.controller');

function createAuditRouter(options = {}) {
  const router = express.Router({
    mergeParams: true,
  });
  const controller = createAuditController(options);

  router.get('/', controller.list);

  return router;
}

module.exports = {
  createAuditRouter,
};
