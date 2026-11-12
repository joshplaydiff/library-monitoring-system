const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const subscribeToReports = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const userId = req.user?.id;
    const { email, frequency } = req.body;

    if (!email || !frequency) {
      return res.status(400).json({ success: false, error: 'Email and frequency are required' });
    }

    const [existing] = await promisePool.query('SELECT id FROM report_subscribers WHERE email = ? AND user_id = ?', [email, userId]);
    if (existing.length > 0) {
      await promisePool.query('UPDATE report_subscribers SET frequency = ?, is_active = TRUE WHERE id = ?', [frequency, existing[0].id]);
      return res.json({ success: true, message: 'Subscription updated' });
    }

    const [result] = await promisePool.query(
      'INSERT INTO report_subscribers (email, frequency, user_id) VALUES (?, ?, ?)',
      [email, frequency, userId]
    );

    res.status(201).json({ success: true, message: 'Subscribed to reports' });
  } catch (error) {
    console.error('Error subscribing to reports:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe', message: error.message });
  }
};

const unsubscribeFromReports = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { email } = req.body;

    await promisePool.query('UPDATE report_subscribers SET is_active = FALSE WHERE email = ? AND user_id = ?', [email, userId]);
    res.json({ success: true, message: 'Unsubscribed from reports' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ success: false, error: 'Failed to unsubscribe', message: error.message });
  }
};

const getReportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const [history] = await promisePool.query('SELECT * FROM report_history ORDER BY generated_at DESC LIMIT ? OFFSET ?', [limitNum, offset]);
    const [countResult] = await promisePool.query('SELECT COUNT(*) as total FROM report_history');

    res.json({
      success: true,
      data: history,
      pagination: { total: countResult[0]?.total || 0, page: pageNum, limit: limitNum, pages: Math.ceil((countResult[0]?.total || 0) / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching report history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch report history', message: error.message });
  }
};

const getReportSubscribers = async (req, res) => {
  try {
    const [subscribers] = await promisePool.query('SELECT id, email, frequency, is_active, created_at FROM report_subscribers');
    res.json({ success: true, data: subscribers });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscribers', message: error.message });
  }
};

router.post('/subscribe', authenticateToken, subscribeToReports);
router.delete('/unsubscribe', authenticateToken, unsubscribeFromReports);
router.get('/history', authenticateToken, requireRole('admin', 'librarian'), getReportHistory);
router.get('/subscribers', authenticateToken, requireRole('admin', 'librarian'), getReportSubscribers);

module.exports = router;
