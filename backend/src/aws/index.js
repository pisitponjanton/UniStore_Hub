'use strict';

module.exports = {
  ...require('./client-options'),
  ...require('./dynamodb'),
  ...require('./s3'),
  ...require('./sqs'),
};
