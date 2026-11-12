const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const getSuggestions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = 'SELECT s.*, u.full_name, u.email, u.student_id FROM suggestions s JOIN users u ON s.user_id = u.id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.created_at DESC';
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const [suggestions] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);
    const [countResult] = await promisePool.query('SELECT COUNT(*) as total FROM suggestions WHERE 1=1' + (status ? ' AND status = ?' : ''), status ? [status] : []);

    res.json({
      success: true,
      data: suggestions,
      pagination: { total: countResult[0]?.total || 0, page: pageNum, limit: limitNum, pages: Math.ceil((countResult[0]?.total || 0) / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suggestions', message: error.message });
  }
};

const createSuggestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const userId = req.user?.id;
    const { title, author, isbn, notes } = req.body;

    if (!title || !author) {
      return res.status(400).json({ success: false, error: 'Title and author are required' });
    }

    const [result] = await promisePool.query(
      'INSERT INTO suggestions (user_id, title, author, isbn, notes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, author, isbn || null, notes || null, 'pending']
    );

    const [suggestion] = await promisePool.query('SELECT * FROM suggestions WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: suggestion[0], message: 'Suggestion submitted successfully' });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    res.status(500).json({ success: false, error: 'Failed to submit suggestion', message: error.message });
  }
};

const updateSuggestionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const [result] = await promisePool.query(
      'UPDATE suggestions SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [status, req.user?.id || reviewed_by, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Suggestion not found' });
    }

    const [updated] = await promisePool.query('SELECT * FROM suggestions WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0], message: `Suggestion ${status}` });
  } catch (error) {
    console.error('Error updating suggestion:', error);
    res.status(500).json({ success: false, error: 'Failed to update suggestion', message: error.message });
  }
};

const getMySuggestions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [suggestions] = await promisePool.query('SELECT * FROM suggestions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error fetching my suggestions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suggestions', message: error.message });
  }
};

router.get('/', authenticateToken, requireRole('admin', 'librarian'), getSuggestions);
router.post('/', authenticateToken, createSuggestion);
router.get('/my', authenticateToken, getMySuggestions);
router.put('/:id/status', authenticateToken, requireRole('admin', 'librarian'), updateSuggestionStatus);

module.exports = router;
