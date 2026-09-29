'use strict';

const express = require('express');
const { createAuthController } = require('./auth.controller');

function createAuthRouter(options = {}) {
  const router = express.Router();
  const controller = createAuthController(options);

  router.post('/register', controller.register);
  router.post('/login', controller.login);

  return router;
}

module.exports = {
  createAuthRouter,
};
