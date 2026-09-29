'use strict';

const express = require('express');
const { createFileController } = require('./file.controller');

function createFileRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createFileController(options);

  router.post('/download-url', controller.privateDownloadUrl);

  return router;
}

module.exports = {
  createFileRouter,
};
