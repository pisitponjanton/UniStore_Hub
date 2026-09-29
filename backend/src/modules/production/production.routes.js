'use strict';

const express = require('express');
const {
  createProductionController,
} = require('./production.controller');

function createProductionRouter(options = {}) {
  const router = express.Router({
    mergeParams: true,
  });
  const controller =
    createProductionController(options);

  router.get('/', controller.summary);

  return router;
}

module.exports = {
  createProductionRouter,
};
