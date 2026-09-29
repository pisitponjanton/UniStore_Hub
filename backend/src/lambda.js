'use strict';

const serverlessExpress = require('@codegenie/serverless-express');
const { app } = require('./app');

const handler = serverlessExpress({ app });

module.exports = {
  handler,
};
