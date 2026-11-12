const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');
const { promisePool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateUserQR } = require('../utils/qrGenerator');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const getRegisteredUsers = async (req, res) => {
  try {
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Only librarian/administrator can list all users
    if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Librarian or administrator account required.'
      });
    }

    const { page, limit, search, user_type, department } = req.query;

    let query = 'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department, course as program_designation, year_level as year_level_status, is_password_set, created_at as import_date FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (full_name LIKE ? OR student_id LIKE ? OR official_id LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (user_type) {
      query += ' AND user_type = ?';
      params.push(user_type);
    }

    if (department) {
      query += ' AND department LIKE ?';
      params.push(`%${department}%`);
    }

    query += ' ORDER BY created_at DESC';

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const [users] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);

    const [countResult] = await promisePool.query(
      'SELECT COUNT(*) as total FROM users WHERE 1=1' +
      (search ? ' AND (full_name LIKE ? OR student_id LIKE ? OR official_id LIKE ? OR email LIKE ?)' : '') +
      (user_type ? ' AND user_type = ?' : '') +
      (department ? ' AND department LIKE ?' : ''),
      [
        search ? `%${search}%` : null,
        search ? `%${search}%` : null,
        search ? `%${search}%` : null,
        search ? `%${search}%` : null,
        user_type || null,
        department ? `%${department}%` : null
      ].filter(Boolean)
    );

    res.json({
      success: true,
      data: users,
      pagination: {
        total: countResult[0]?.total || 0,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((countResult[0]?.total || 0) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching registered users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch registered users',
      message: error.message
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Librarian/administrator can view any user; patrons can only view themselves
    if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      if (String(requestingUserId) !== String(id)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view your own account.'
        });
      }
    }

    const [users] = await promisePool.query(
      'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department, course as program_designation, year_level as year_level_status, is_password_set, created_at as import_date FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error.message
    });
  }
};

const updateRegisteredUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Librarian/administrator can update any user; patrons can only update themselves
    if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      if (String(requestingUserId) !== String(id)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update your own account.'
        });
      }
    }

    const allowedFields = ['full_name', 'email', 'user_type', 'department', 'course', 'year_level'];

    // Patrons cannot change their role; only librarian/administrator can
    if (updateData.role && requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      delete updateData.role;
    }

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(id);

    const [result] = await promisePool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const [updatedUser] = await promisePool.query(
      'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department, course as program_designation, year_level as year_level_status, is_password_set, created_at as import_date FROM users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: updatedUser[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error.message
    });
  }
};

const deleteRegisteredUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserRole = req.user?.role;

    // Only librarian/administrator can delete users
    if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Librarian or administrator account required.'
      });
    }

    const [result] = await promisePool.query('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message
    });
  }
};

const getRegisteredUsersStats = async (req, res) => {
  try {
    const requestingUserRole = req.user?.role;

    // Only librarian/administrator can view stats
    if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Librarian or administrator account required.'
      });
    }

    const [totalUsers] = await promisePool.query('SELECT COUNT(*) as total FROM users');
    const [usersByType] = await promisePool.query('SELECT user_type, COUNT(*) as count FROM users GROUP BY user_type');
    const [usersByDepartment] = await promisePool.query('SELECT department, COUNT(*) as count FROM users WHERE department IS NOT NULL GROUP BY department ORDER BY count DESC LIMIT 10');
    const [recentUsers] = await promisePool.query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');

    res.json({
      success: true,
      data: {
        total: totalUsers[0]?.total || 0,
        byType: usersByType,
        byDepartment: usersByDepartment,
        recentAdditions: recentUsers[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user stats',
      message: error.message
    });
  }
};

const importRegisteredUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { batch_id, imported_by } = req.body;
    const results = [];
    let successful = 0;
    let failed = 0;

    const fileContent = req.file.buffer.toString('utf-8');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim());

    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      try {
        const values = parseCSVLine(line);
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const { student_id, full_name, user_type, email, department, course, year_level, official_id, id_classification } = row;

        if (!full_name) {
          failed++;
          continue;
        }

        // Use official_id if provided, otherwise fall back to student_id for backward compatibility
        const officialIdentifier = (official_id || '').trim() || (student_id || '').trim();
        const classification = id_classification || user_type || 'student';
        // Normal patron imports always assign 'patron' role; never trust CSV role field
        const appRole = 'patron';

        if (!officialIdentifier) {
          failed++;
          continue;
        }

        // Check for existing user by official_id + classification, or by student_id for backward compatibility
        let existing;
        if (official_id && official_id.trim()) {
          [existing] = await promisePool.query(
            'SELECT id, is_password_set, password_hash FROM users WHERE official_id = ? AND id_classification = ?',
            [official_id.trim(), classification]
          );
        } else {
          [existing] = await promisePool.query('SELECT id, is_password_set, password_hash FROM users WHERE student_id = ?', [student_id.trim()]);
        }

        const qrPayload = {
          id_type: classification,
          official_id: officialIdentifier
        };

        if (existing.length > 0) {
          // Preserve existing password and activation status; do not reset is_password_set
          await promisePool.query(
            'UPDATE users SET full_name = ?, email = ?, user_type = ?, id_classification = ?, department = ?, course = ?, year_level = ? WHERE id = ?',
            [full_name, email || null, user_type || 'student', classification, department || null, course || null, year_level || null, existing[0].id]
          );
        } else {
          const [result] = await promisePool.query(
            'INSERT INTO users (student_id, official_id, id_classification, role, full_name, user_type, email, department, course, year_level, is_password_set) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
            [student_id || null, officialIdentifier, classification, appRole, full_name, user_type || 'student', email || null, department || null, course || null, year_level || null]
          );

          await generateUserQR({ id: result.insertId, student_id: officialIdentifier, full_name, user_type: classification, department, official_id: officialIdentifier, id_classification: classification, qr_payload: qrPayload });
        }

        successful++;
        results.push({ official_id: officialIdentifier, id_classification: classification, full_name, status: 'success' });
      } catch (error) {
        failed++;
        results.push({ error: error.message, status: 'failed' });
      }
    }

    const [batchResult] = await promisePool.query(
      'INSERT INTO import_batches (batch_id, filename, total_records, successful_imports, failed_imports, imported_by) VALUES (?, ?, ?, ?, ?, ?)',
      [batch_id || `batch_${Date.now()}`, req.file.originalname, dataLines.length, successful, failed, imported_by || 'system']
    );

    res.json({
      success: true,
      data: {
        batchId: batchResult.insertId,
        totalRecords: dataLines.length,
        successfulImports: successful,
        failedImports: failed,
        results
      },
      message: `Import completed: ${successful} successful, ${failed} failed`
    });
  } catch (error) {
    console.error('Error importing users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import users',
      message: error.message
    });
  }
};

const getImportBatches = async (req, res) => {
  try {
    const [batches] = await promisePool.query(
      'SELECT * FROM import_batches ORDER BY import_date DESC LIMIT 50'
    );

    res.json({
      success: true,
      data: batches || []
    });
  } catch (error) {
    console.error('Error fetching import batches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch import batches',
      message: error.message
    });
  }
};

router.get('/', authenticateToken, requireRole('librarian', 'administrator'), getRegisteredUsers);
router.get('/stats', authenticateToken, requireRole('librarian', 'administrator'), getRegisteredUsersStats);
router.get('/import-batches', authenticateToken, requireRole('librarian', 'administrator'), getImportBatches);
router.get('/:id', authenticateToken, getUserById);
router.put('/:id', authenticateToken, updateRegisteredUser);
router.delete('/:id', authenticateToken, requireRole('librarian', 'administrator'), deleteRegisteredUser);
router.post('/import', authenticateToken, requireRole('librarian', 'administrator'), upload.single('file'), importRegisteredUsers);

module.exports = router;