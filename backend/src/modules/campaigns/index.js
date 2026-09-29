'use strict';

const { CAMPAIGN_STATUS } = require('./campaign.constants');
const {
  createCampaignController,
} = require('./campaign.controller');
const { toCampaignDto } = require('./campaign.mapper');
const {
  ALLOWED_TRANSITIONS,
  assertCampaignTransition,
  assertDraftCampaign,
} = require('./campaign.policy');
const {
  CANCELLATION_BLOCKING_ORDER_STATUSES,
  CANCELLABLE_ORDER_STATUSES,
  COMPLETION_BLOCKING_ORDER_STATUSES,
  createCampaignProgressionService,
} = require('./campaign-progression.service');
const {
  createCampaignRepository,
} = require('./campaign.repository');
const { createCampaignRouter } = require('./campaign.routes');
const {
  createCampaignService,
  isConditionalConflict,
} = require('./campaign.service');

module.exports = {
  CAMPAIGN_STATUS,
  createCampaignController,
  toCampaignDto,
  ALLOWED_TRANSITIONS,
  assertCampaignTransition,
  assertDraftCampaign,
  CANCELLATION_BLOCKING_ORDER_STATUSES,
  CANCELLABLE_ORDER_STATUSES,
  COMPLETION_BLOCKING_ORDER_STATUSES,
  createCampaignProgressionService,
  createCampaignRepository,
  createCampaignRouter,
  createCampaignService,
  isConditionalConflict,
};
