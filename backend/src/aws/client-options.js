'use strict';

const { config } = require('../config');

function buildAwsClientOptions(overrides = {}) {
  const endpoint = overrides.endpoint ?? config.awsEndpointUrl;
  const region = overrides.region ?? config.awsRegion;

  return {
    region,
    ...(endpoint ? { endpoint } : {}),
  };
}

module.exports = {
  buildAwsClientOptions,
};
