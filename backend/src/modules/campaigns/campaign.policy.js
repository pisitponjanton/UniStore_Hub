'use strict';

const { AppError } = require('../../errors/app-error');
const { CAMPAIGN_STATUS } = require('./campaign.constants');

const ALLOWED_TRANSITIONS = Object.freeze({
  [CAMPAIGN_STATUS.DRAFT]: Object.freeze([
    CAMPAIGN_STATUS.OPEN,
    CAMPAIGN_STATUS.CANCELLED,
  ]),
  [CAMPAIGN_STATUS.OPEN]: Object.freeze([
    CAMPAIGN_STATUS.CLOSED,
    CAMPAIGN_STATUS.CANCELLED,
  ]),
  [CAMPAIGN_STATUS.CLOSED]: Object.freeze([
    CAMPAIGN_STATUS.PRODUCING,
    CAMPAIGN_STATUS.CANCELLED,
  ]),
  [CAMPAIGN_STATUS.PRODUCING]: Object.freeze([
    CAMPAIGN_STATUS.READY_FOR_PICKUP,
  ]),
  [CAMPAIGN_STATUS.READY_FOR_PICKUP]: Object.freeze([
    CAMPAIGN_STATUS.COMPLETED,
  ]),
  [CAMPAIGN_STATUS.COMPLETED]: Object.freeze([]),
  [CAMPAIGN_STATUS.CANCELLED]: Object.freeze([]),
});

function invalidStatusTransition(fromStatus, toStatus) {
  return new AppError({
    code: 'INVALID_STATUS_TRANSITION',
    message: `Cannot transition campaign from ${fromStatus} to ${toStatus}`,
    httpStatus: 409,
  });
}

function assertCampaignTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];

  if (!allowed || !allowed.includes(toStatus)) {
    throw invalidStatusTransition(fromStatus, toStatus);
  }

  return true;
}

function assertDraftCampaign(status) {
  if (status !== CAMPAIGN_STATUS.DRAFT) {
    throw invalidStatusTransition(
      status,
      CAMPAIGN_STATUS.DRAFT,
    );
  }
}

module.exports = {
  ALLOWED_TRANSITIONS,
  assertCampaignTransition,
  assertDraftCampaign,
  invalidStatusTransition,
};
