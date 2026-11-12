const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { broadcastNewLog, broadcastAnalyticsUpdate } = require('../utils/socketManager');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');

const validateLog = [
  body('name').notEmpty().withMessage('Name is required'),
  body('purpose').notEmpty().withMessage('Purpose is required'),
  body('log_type').isIn(['entry', 'exit']).withMessage('Log type must be entry or exit'),
  body('user_type').optional().isIn(['student', 'faculty', 'staff', 'guest', 'visitor', 'walk-in']),
  body('user_id').optional().isInt(),
  body('student_id').optional().notEmpty(),
  body('section').optional().isIn(['Main Library', 'Learning Commons', 'Meeting Room']),
  body('room_id').optional().isInt()
];

router.post('/', authenticateToken, validateLog, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { name, purpose, log_type, user_type, user_id, student_id, official_id, id_classification, section, room_id } = req.body;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    let resolvedUserId = user_id ? Number(user_id) : null;

    // Librarian/administrator can create attendance for any patron
    if (requestingUserRole === 'librarian' || requestingUserRole === 'administrator') {
      if (official_id && id_classification) {
        // Classification-aware resolution: official_id + id_classification
        const [users] = await promisePool.query(
          'SELECT id FROM users WHERE official_id = ? AND id_classification = ?',
          [official_id, id_classification]
        );
        if (users.length > 0) {
          resolvedUserId = users[0].id;
        } else if (student_id) {
          const [usersByStudentId] = await promisePool.query(
            'SELECT id FROM users WHERE student_id = ?',
            [student_id]
          );
          if (usersByStudentId.length > 0) {
            resolvedUserId = usersByStudentId[0].id;
          }
        }
      } else if (student_id) {
        const [users] = await promisePool.query(
          'SELECT id FROM users WHERE student_id = ?',
          [student_id]
        );
        if (users.length > 0) {
          resolvedUserId = users[0].id;
        }
      }
      // If no user resolved and no user_id provided, allow walk-in (resolvedUserId stays null)
    }
    // Patron can only create attendance for themselves
    else if (requestingUserRole === 'patron') {
      resolvedUserId = requestingUserId;
    }
    // Unknown role — deny
    else {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions to record attendance.'
      });
    }

    const [result] = await promisePool.query(
      'INSERT INTO visit_logs (user_id, user_type, name, purpose, section, room_id, log_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [resolvedUserId, user_type || 'visitor', name, purpose, section || null, room_id || null, log_type]
    );

    const [newLog] = await promisePool.query(
      'SELECT * FROM visit_logs WHERE id = ?',
      [result.insertId]
    );

    broadcastNewLog(newLog[0]);

    res.status(201).json({
      success: true,
      data: newLog[0]
    });
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create log',
      message: error.message
    });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { logs } = req.body;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    if (!Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        error: 'Logs must be an array'
      });
    }

    // Patrons can only sync their own logs
    if (requestingUserRole === 'patron') {
      const patronLogs = logs.filter((log) => log.user_id && Number(log.user_id) === requestingUserId);
      if (patronLogs.length !== logs.length) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Patrons can only sync their own attendance records.'
        });
      }
    }

    const syncedLogs = [];
    for (const log of logs) {
      const [result] = await promisePool.query(
        'INSERT INTO visit_logs (user_id, user_type, name, purpose, log_type, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [log.user_id || null, log.user_type || 'visitor', log.name, log.purpose, log.log_type, log.timestamp || new Date()]
      );
      const [newLog] = await promisePool.query('SELECT * FROM visit_logs WHERE id = ?', [result.insertId]);
      syncedLogs.push(newLog[0]);
    }

    broadcastAnalyticsUpdate();

    res.json({
      success: true,
      data: syncedLogs,
      message: `Successfully synced ${syncedLogs.length} logs`
    });
  } catch (error) {
    console.error('Error syncing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync logs',
      message: error.message
    });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { user_type, purpose, startDate, endDate, limit, page } = req.query;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    let query = 'SELECT * FROM visit_logs WHERE 1=1';
    const params = [];

    // Patrons can only see their own attendance records
    if (requestingUserRole === 'patron') {
      query += ' AND user_id = ?';
      params.push(requestingUserId);
    }

    if (user_type) {
      query += ' AND user_type = ?';
      params.push(user_type);
    }

    if (purpose) {
      query += ' AND purpose LIKE ?';
      params.push(`%${purpose}%`);
    }

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    if (page) {
      const offset = (parseInt(page) - 1) * (parseInt(limit) || 10);
      query += ' OFFSET ?';
      params.push(offset);
    }

    const [logs] = await promisePool.query(query, params);

    let total = logs.length;
    if (limit && !page) {
      let countQuery = 'SELECT COUNT(*) as total FROM visit_logs WHERE 1=1';
      const countParams = [];

      if (requestingUserRole === 'patron') {
        countQuery += ' AND user_id = ?';
        countParams.push(requestingUserId);
      }

      if (user_type) {
        countQuery += ' AND user_type = ?';
        countParams.push(user_type);
      }

      if (purpose) {
        countQuery += ' AND purpose LIKE ?';
        countParams.push(`%${purpose}%`);
      }

      if (startDate) {
        countQuery += ' AND timestamp >= ?';
        countParams.push(startDate);
      }

      if (endDate) {
        countQuery += ' AND timestamp <= ?';
        countParams.push(endDate);
      }

      const [countResult] = await promisePool.query(countQuery, countParams);
      total = countResult[0]?.total || 0;
    }

    res.json({
      success: true,
      data: logs,
      pagination: limit ? {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      } : undefined
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

router.get('/analytics', authenticateToken, async (req, res) => {
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
});

router.get('/active-users', authenticateToken, async (req, res) => {
  try {
    const [activeUsers] = await promisePool.query(`
      SELECT vl.user_id, vl.name, vl.user_type, vl.purpose, vl.timestamp
      FROM visit_logs vl
      INNER JOIN (
        SELECT user_id, MAX(timestamp) as latest_entry
        FROM visit_logs
        WHERE log_type = 'entry'
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
        GROUP BY user_id
      ) latest ON vl.user_id = latest.user_id AND vl.timestamp = latest.latest_entry
      WHERE vl.log_type = 'entry'
      AND vl.user_id NOT IN (
        SELECT user_id FROM visit_logs 
        WHERE log_type = 'exit' 
        AND timestamp > (
          SELECT MAX(timestamp) FROM visit_logs 
          WHERE log_type = 'entry' AND user_id = vl.user_id
        )
      )
      ORDER BY vl.timestamp DESC
    `);

    res.json({
      success: true,
      data: activeUsers
    });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active users',
      message: error.message
    });
  }
});

router.get('/active-session', authenticateToken, async (req, res) => {
  try {
    const { visitorId } = req.query;

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        error: 'Visitor ID is required'
      });
    }

    let resolvedUserId = Number(visitorId);

    if (isNaN(resolvedUserId)) {
      const [users] = await promisePool.query(
        'SELECT id FROM users WHERE student_id = ? OR official_id = ?',
        [visitorId, visitorId]
      );

      if (users.length > 0) {
        resolvedUserId = users[0].id;
      }
    }

    const [activeSession] = await promisePool.query(`
      SELECT * FROM visit_logs
      WHERE user_id = ? AND log_type = 'entry'
      AND id = (
        SELECT MAX(id) FROM visit_logs WHERE user_id = ? AND log_type = 'entry'
      )
    `, [resolvedUserId, resolvedUserId]);

    if (activeSession.length === 0) {
      return res.json({
        success: true,
        active: false,
        data: null
      });
    }

    const [exitLog] = await promisePool.query(`
      SELECT * FROM visit_logs
      WHERE user_id = ? AND log_type = 'exit'
      AND timestamp > ?
      LIMIT 1
    `, [resolvedUserId, activeSession[0].timestamp]);

    if (exitLog.length > 0) {
      return res.json({
        success: true,
        active: false,
        data: null
      });
    }

    res.json({
      success: true,
      active: true,
      data: activeSession[0]
    });
  } catch (error) {
    console.error('Error checking active session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check active session',
      message: error.message
    });
  }
});

router.post('/logout/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Patrons can only log themselves out
    if (requestingUserRole === 'patron' && String(requestingUserId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only log out your own attendance session.'
      });
    }

    const [activeEntry] = await promisePool.query(`
      SELECT * FROM visit_logs
      WHERE user_id = ? AND log_type = 'entry'
      AND id = (
        SELECT MAX(id) FROM visit_logs WHERE user_id = ? AND log_type = 'entry'
      )
    `, [userId, userId]);

    if (activeEntry.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active entry found for this user'
      });
    }

    await promisePool.query(
      'INSERT INTO visit_logs (user_id, user_type, name, purpose, log_type, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, activeEntry[0].user_type, activeEntry[0].name, activeEntry[0].purpose, 'exit']
    );

    broadcastNewLog({
      user_id: userId,
      log_type: 'exit',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout user',
      message: error.message
    });
  }
});

router.get('/analytics/historical', authenticateToken, async (req, res) => {
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
});

router.get('/analytics/trends', authenticateToken, async (req, res) => {
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
});

router.get('/analytics/capacity', authenticateToken, async (req, res) => {
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
});

router.get('/analytics/engagement', authenticateToken, async (req, res) => {
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
});

/**
 * Resolve a patron by official_id and id_type (classification).
 * Used by QR scanner to look up patron data from a static QR code.
 */
router.get('/resolve-user', authenticateToken, async (req, res) => {
  try {
    const { official_id, id_type } = req.query;

    if (!official_id || !id_type) {
      return res.status(400).json({
        success: false,
        error: 'official_id and id_type are required'
      });
    }

    const [users] = await promisePool.query(
      'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department, course as program_designation, year_level as year_level_status FROM users WHERE official_id = ? AND id_classification = ?',
      [official_id, id_type]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patron not found. Please register first.'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        user_id: user.id,
        student_id: user.student_id || user.official_id,
        official_id: user.official_id,
        id_type: user.id_classification,
        name: user.full_name,
        user_type: user.user_type,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Error resolving user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve patron',
      message: error.message
    });
  }
});

/**
 * Server-authoritative QR attendance scan.
 * Resolves patron from official_id + id_type, checks active session within a
 * transaction using SELECT ... FOR UPDATE row locking, records entry or exit,
 * and returns the result with server-generated timestamp.
 * Idempotent via client_event_id UNIQUE constraint.
 */
router.post('/scan',
  authenticateToken,
  requireRole('librarian', 'administrator'),
  [
    body('client_event_id').notEmpty().withMessage('client_event_id is required'),
    body('official_id').notEmpty().withMessage('official_id is required'),
    body('id_type').isIn(['student', 'faculty', 'support_staff']).withMessage('id_type must be student, faculty, or support_staff'),
    body('purpose').optional().notEmpty().withMessage('purpose is required if provided'),
    body('section').optional().isIn(['Main Library', 'Learning Commons', 'Meeting Room']),
    body('room_id').optional().isInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const {
      client_event_id,
      official_id,
      id_type,
      purpose,
      section,
      room_id
    } = req.body;

    const requestingUserRole = req.user?.role;

    // Only librarian/administrator can scan attendance for patrons
    if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Librarian or administrator account required.'
      });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      try {
        // Idempotency: check if this client_event_id was already processed
        const [existing] = await connection.query(
          'SELECT id, user_id, log_type, timestamp, section, room_id FROM visit_logs WHERE client_event_id = ?',
          [client_event_id]
        );

        if (existing.length > 0) {
          await connection.rollback();
          return res.status(200).json({
            success: true,
            data: {
              id: existing[0].id,
              user_id: existing[0].user_id,
              log_type: existing[0].log_type,
              timestamp: existing[0].timestamp,
              section: existing[0].section,
              room_id: existing[0].room_id,
              idempotent: true
            },
            message: 'Attendance event already recorded.'
          });
        }

        // Resolve and lock the patron row to prevent concurrent duplicate sessions
        const [users] = await connection.query(
          'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department FROM users WHERE official_id = ? AND id_classification = ? FOR UPDATE',
          [official_id, id_type]
        );

        if (users.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            error: 'Patron not found. Please register first.'
          });
        }

        const patron = users[0];
        const resolvedUserId = patron.id;

        // Check active session: most recent entry without a subsequent exit
        const [latestEntry] = await connection.query(
          `SELECT id, timestamp FROM visit_logs
           WHERE user_id = ? AND log_type = 'entry'
           ORDER BY timestamp DESC, id DESC
           LIMIT 1`,
          [resolvedUserId]
        );

        let logType = 'entry';

        if (latestEntry.length > 0) {
          const entryTimestamp = latestEntry[0].timestamp;

          // Check if there's a subsequent exit after this entry
          const [subsequentExit] = await connection.query(
            `SELECT id FROM visit_logs
             WHERE user_id = ? AND log_type = 'exit' AND timestamp > ?
             ORDER BY timestamp ASC, id ASC
             LIMIT 1`,
            [resolvedUserId, entryTimestamp]
          );

          if (subsequentExit.length === 0) {
            // Active session exists → this scan is an exit
            logType = 'exit';
          }
        }

        // Insert the attendance record with server-generated timestamp
        const [result] = await connection.query(
          `INSERT INTO visit_logs
             (user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)`,
          [
            resolvedUserId,
            patron.user_type,
            patron.full_name,
            purpose || 'General',
            section || 'Main Library',
            room_id || null,
            logType,
            client_event_id
          ]
        );

        await connection.commit();

        const [newLog] = await connection.query(
          'SELECT id, user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id FROM visit_logs WHERE id = ?',
          [result.insertId]
        );

        broadcastNewLog(newLog[0]);

        return res.status(201).json({
          success: true,
          data: {
            id: newLog[0].id,
            user_id: newLog[0].user_id,
            official_id: patron.official_id,
            id_type: patron.id_classification,
            name: newLog[0].name,
            user_type: newLog[0].user_type,
            purpose: newLog[0].purpose,
            section: newLog[0].section,
            room_id: newLog[0].room_id,
            log_type: newLog[0].log_type,
            timestamp: newLog[0].timestamp,
            client_event_id: newLog[0].client_event_id,
            idempotent: false
          },
          message: `Attendance recorded as ${logType}.`
        });
      } catch (error) {
        // Handle duplicate key conflict from UNIQUE constraint on client_event_id
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('client_event_id')) {
          // Another request already committed this event_id — retrieve it
          const [existing] = await connection.query(
            'SELECT id, user_id, log_type, timestamp, section, room_id FROM visit_logs WHERE client_event_id = ?',
            [client_event_id]
          );

          await connection.rollback();
          if (existing.length > 0) {
            return res.status(200).json({
              success: true,
              data: {
                id: existing[0].id,
                user_id: existing[0].user_id,
                log_type: existing[0].log_type,
                timestamp: existing[0].timestamp,
                section: existing[0].section,
                room_id: existing[0].room_id,
                idempotent: true
              },
              message: 'Attendance event already recorded.'
            });
          }
          return res.status(200).json({
            success: true,
            data: null,
            idempotent: true,
            message: 'Attendance event already recorded.'
          });
        }

        if (connection) {
          await connection.rollback();
        }
        throw error;
      }
    } catch (error) {
      console.error('Error scanning attendance:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to record attendance',
        message: error.message
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;