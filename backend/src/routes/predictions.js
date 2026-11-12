const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getPredictiveAnalytics } = require('../utils/analytics');

const getPredictions = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const predictions = await getPredictiveAnalytics(parseInt(days));
    res.json({ success: true, data: predictions });
  } catch (error) {
    console.error('Error fetching predictive analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch predictions', message: error.message });
  }
};

router.get('/predictions', authenticateToken, getPredictions);

module.exports = router;
