'use strict';

const { sendList, sendSuccess } = require('../../utils/response');
const {
  validateCampaignStatusFilter,
  validateCreateCampaignBody,
  validateUpdateCampaignBody,
} = require('../../validators/campaign.validator');
const { CAMPAIGN_STATUS } = require('./campaign.constants');
const {
  createCampaignProgressionService,
} = require('./campaign-progression.service');
const { createCampaignService } = require('./campaign.service');

function createCampaignController(options = {}) {
  const campaignService =
    options.campaignService || createCampaignService(options);
  const progressionService =
    options.campaignProgressionService ||
    createCampaignProgressionService({
      ...options,
      campaignService,
    });

  async function transition(req, res, next, toStatus) {
    try {
      const campaign =
        await campaignService.transitionCampaign({
          organizationId: req.params.organizationId,
          campaignId: req.params.campaignId,
          actorId: req.user.userId,
          toStatus,
        });

      return sendSuccess(res, campaign);
    } catch (error) {
      return next(error);
    }
  }

  async function progress(req, res, next, methodName) {
    try {
      const campaign =
        await progressionService[methodName]({
          organizationId: req.params.organizationId,
          campaignId: req.params.campaignId,
          actorId: req.user.userId,
        });

      return sendSuccess(res, campaign);
    } catch (error) {
      return next(error);
    }
  }

  return {
    async list(req, res, next) {
      try {
        const status = validateCampaignStatusFilter(
          typeof req.query.status === 'string'
            ? req.query.status
            : undefined,
        );
        const result = await campaignService.listCampaigns({
          organizationId: req.params.organizationId,
          storeId:
            typeof req.query.storeId === 'string' &&
            req.query.storeId.length > 0
              ? req.query.storeId
              : undefined,
          status,
          cursor:
            typeof req.query.cursor === 'string'
              ? req.query.cursor
              : undefined,
        });

        return sendList(
          res,
          result.items,
          result.nextCursor,
        );
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const input = validateCreateCampaignBody(req.body);
        const campaign =
          await campaignService.createCampaign({
            organizationId: req.params.organizationId,
            actorId: req.user.userId,
            ...input,
          });

        return sendSuccess(res, campaign, 201);
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        return sendSuccess(
          res,
          await campaignService.getCampaign({
            organizationId: req.params.organizationId,
            campaignId: req.params.campaignId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const changes = validateUpdateCampaignBody(req.body);
        const campaign =
          await campaignService.updateCampaign({
            organizationId: req.params.organizationId,
            campaignId: req.params.campaignId,
            actorId: req.user.userId,
            changes,
          });

        return sendSuccess(res, campaign);
      } catch (error) {
        return next(error);
      }
    },

    open(req, res, next) {
      return transition(
        req,
        res,
        next,
        CAMPAIGN_STATUS.OPEN,
      );
    },

    close(req, res, next) {
      return progress(
        req,
        res,
        next,
        'closeCampaign',
      );
    },

    startProduction(req, res, next) {
      return progress(
        req,
        res,
        next,
        'startProduction',
      );
    },

    readyForPickup(req, res, next) {
      return progress(
        req,
        res,
        next,
        'readyForPickup',
      );
    },

    complete(req, res, next) {
      return progress(
        req,
        res,
        next,
        'completeCampaign',
      );
    },

    cancel(req, res, next) {
      return progress(
        req,
        res,
        next,
        'cancelCampaign',
      );
    },
  };
}

module.exports = {
  createCampaignController,
};
