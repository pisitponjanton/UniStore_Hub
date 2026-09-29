'use strict';

const express = require('express');
const { createMemberController } = require('./member.controller');

function createMemberRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createMemberController(options);

  router.get('/', controller.list);
  router.post('/', controller.add);
  router.patch('/:userId', controller.updateRole);
  router.delete('/:userId', controller.remove);

  return router;
}

module.exports = {
  createMemberRouter,
};
