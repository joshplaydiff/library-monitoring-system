const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');

const getAnalytics = async (req, res) => {
  try {
    const { period = 'week', section, room_id } = req.query;

    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Must be day, week, or month'
      });
    }

    const { getAnalyticsData } = require('../utils/analytics');
    const analytics = await getAnalyticsData(period, section, room_id);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
};

const getHistoricalAnalytics = async (req, res) => {
  try {
    const { comparisonType, referenceDate } = req.query;

    if (!['week-over-week', 'month-over-month', 'year-over-year'].includes(comparisonType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid comparison type'
      });
    }

    const { getHistoricalAnalytics } = require('../utils/analytics');
    const data = await getHistoricalAnalytics(comparisonType, referenceDate);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching historical analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical analytics',
      message: error.message
    });
  }
};

const getTrendAnalytics = async (req, res) => {
  try {
    const { period, count, referenceDate } = req.query;

    if (!['week', 'month', 'year'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period'
      });
    }

    const { getTrendAnalytics } = require('../utils/analytics');
    const data = await getTrendAnalytics(period, parseInt(count) || 12, referenceDate);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching trend analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend analytics',
      message: error.message
    });
  }
};

const getCapacityAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const { getCapacityAnalytics } = require('../utils/analytics');
    const data = await getCapacityAnalytics(period);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching capacity analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity analytics',
      message: error.message
    });
  }
};

const getEngagementAnalytics = async (req, res) => {
  try {
    const { minVisits = 2, daysBack = 30 } = req.query;

    const { getEngagementAnalytics } = require('../utils/analytics');
    const data = await getEngagementAnalytics(parseInt(minVisits), parseInt(daysBack));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch engagement analytics',
      message: error.message
    });
  }
};

router.get('/analytics', getAnalytics);
router.get('/analytics/historical', getHistoricalAnalytics);
router.get('/analytics/trends', getTrendAnalytics);
router.get('/analytics/capacity', getCapacityAnalytics);
router.get('/analytics/engagement', getEngagementAnalytics);

module.exports = router;