const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');
const { generateToken, hashPassword, comparePassword, JWT_SECRET, authenticateToken } = require('../middleware/auth');

const loginValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { username, password } = req.body;

    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE student_id = ? OR official_id = ? OR email = ?',
      [username, username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const user = users[0];

    // Only librarian and administrator roles can use the admin login
    if (user.role !== 'librarian' && user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Librarian or administrator account required.'
      });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Please set up your password first'
      });
    }

    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const token = generateToken(user);
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

router.post('/login/user', async (req, res) => {
  try {
    const { student_id, password } = req.body;

    if (!student_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and password are required'
      });
    }

    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE student_id = ? OR official_id = ?',
      [student_id, student_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Account not found. Please register first.'
      });
    }

    const user = users[0];

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Please set up your password first'
      });
    }

    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Student ID or password'
      });
    }

    const token = generateToken(user);
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { student_id, email } = req.body;

    if (!student_id || !email) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and UST Gmail are required'
      });
    }

    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE student_id = ? OR official_id = ?',
      [student_id, student_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found. Please contact the librarian.'
      });
    }

    const user = users[0];

    if (!user.email || !user.email.endsWith('@ust.edu.ph')) {
      return res.status(403).json({
        success: false,
        error: 'Account does not have a UST Gmail on file. Please visit the librarian for assistance.'
      });
    }

    if (user.email !== email.trim()) {
      return res.status(403).json({
        success: false,
        error: 'Email does not match our records. Please visit the librarian for assistance.'
      });
    }

    // Generate a secure reset token valid for 1 hour
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await promisePool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [resetToken, resetExpires, user.id]
    );

    // In a production system, email this token to the user's UST Gmail.
    // For development, return it so the librarian can communicate it securely.
    res.json({
      success: true,
      message: 'Reset token generated. Use the /reset-password endpoint with this token to set a new password.',
      data: {
        reset_token: resetToken,
        expires_in_minutes: 60,
        user_id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Password reset failed',
      message: error.message
    });
  }
});

/**
 * Reset password using a valid reset token.
 * Token is invalidated after successful use.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;

    if (!reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Reset token and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_expires > NOW()',
      [reset_token]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    const user = users[0];

    const password_hash = await hashPassword(new_password);

    // Set password and invalidate the reset token in one operation
    await promisePool.query(
      'UPDATE users SET password_hash = ?, is_password_set = 1, reset_token = NULL, reset_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [password_hash, user.id]
    );

    res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Password reset failed',
      message: error.message
    });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: req.user || null
  });
});

/**
 * Account activation for imported patrons who do not yet have a password.
 * Requires a one-time activation token. After successful activation,
 * the token is invalidated and the user can log in normally.
 */
router.post('/activate', async (req, res) => {
  try {
    const { activation_token, new_password } = req.body;

    if (!activation_token || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Activation token and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Look up the user by activation token
    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE activation_token = ? AND activation_expires > NOW()',
      [activation_token]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired activation token'
      });
    }

    const user = users[0];

    // Prevent activating an account that already has a password
    if (user.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Account already has a password set. Please log in instead.'
      });
    }

    const password_hash = await hashPassword(new_password);

    // Set password and invalidate the activation token in one transaction
    await promisePool.query(
      'UPDATE users SET password_hash = ?, is_password_set = 1, activation_token = NULL, activation_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [password_hash, user.id]
    );

    res.json({
      success: true,
      message: 'Account activated successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Account activation error:', error);
    res.status(500).json({
      success: false,
      error: 'Account activation failed',
      message: error.message
    });
  }
});

module.exports = router;