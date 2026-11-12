const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');
const { generateToken, hashPassword, comparePassword, JWT_SECRET, authenticateToken, requireRole } = require('../middleware/auth');

const loginRateLimit = new Map();

const checkRateLimit = (identifier) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!loginRateLimit.has(identifier)) {
    loginRateLimit.set(identifier, []);
  }

  const attempts = loginRateLimit.get(identifier);
  const recentAttempts = attempts.filter((time) => now - time < windowMs);

  if (recentAttempts.length >= maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000) };
  }

  recentAttempts.push(now);
  loginRateLimit.set(identifier, recentAttempts);
  return { allowed: true };
};

const loginValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

router.post('/login', loginValidation, async (req, res) => {
  try {
    const rateLimit = checkRateLimit(`login:${req.ip}`);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimit.retryAfter
      });
    }

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
    const { password_hash, activation_token, reset_token, activation_expires, reset_expires, ...userWithoutSensitive } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutSensitive
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
    const rateLimit = checkRateLimit(`login-user:${req.ip}`);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimit.retryAfter
      });
    }

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
    const { password_hash, activation_token, reset_token, activation_expires, reset_expires, ...userWithoutSensitive } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutSensitive
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

    // Always return a generic response regardless of whether the account exists.
    // This prevents account enumeration via the forgot-password endpoint.
    const genericResponse = {
      success: true,
      message: 'If an account with this ID and email exists, a password reset link has been sent to your UST Gmail.'
    };

    if (users.length === 0) {
      return res.json(genericResponse);
    }

    const user = users[0];

    if (!user.email || !user.email.endsWith('@ust.edu.ph')) {
      return res.json(genericResponse);
    }

    if (user.email !== email.trim()) {
      return res.json(genericResponse);
    }

    // Generate a secure reset token, store only its hash (never plaintext)
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenHash = await hashPassword(resetToken);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await promisePool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [resetTokenHash, resetExpires, user.id]
    );

    // NOTE: In production, send the resetToken via email to user.email.
    // Email delivery is NOT configured in this application. The librarian must
    // communicate the token to the patron through a secure out-of-band channel.
    // Do NOT return the token in the API response.

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Password reset failed',
      message: error.message
    });
  }
});

/**
 * Reset password using a valid reset token.
 * Token is single-use and invalidated atomically after successful consumption.
 * Token comparison uses bcrypt to avoid plaintext token storage.
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

    // Find users with a non-expired reset token hash
    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE reset_token IS NOT NULL AND reset_expires > NOW()',
      []
    );

    let matchedUser = null;

    for (const user of users) {
      const isMatch = await comparePassword(reset_token, user.reset_token);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    const password_hash = await hashPassword(new_password);

    // Atomically set password and invalidate the reset token
    await promisePool.query(
      'UPDATE users SET password_hash = ?, is_password_set = 1, reset_token = NULL, reset_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [password_hash, matchedUser.id]
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

/**
 * Librarian-only: Issue an activation token for an imported patron who has no password.
 * The token is stored as a bcrypt hash and is single-use with 24-hour expiration.
 * The librarian communicates the token to the patron out-of-band.
 */
router.post('/activate-token', authenticateToken, requireRole('librarian', 'administrator'), async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const [users] = await promisePool.query(
      'SELECT id, full_name, is_password_set FROM users WHERE id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    if (user.is_password_set === 1) {
      return res.status(400).json({
        success: false,
        error: 'Account already has a password set'
      });
    }

    // Generate a secure activation token, store only its hash
    const activationToken = require('crypto').randomBytes(32).toString('hex');
    const activationTokenHash = await hashPassword(activationToken);
    const activationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await promisePool.query(
      'UPDATE users SET activation_token = ?, activation_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [activationTokenHash, activationExpires, user_id]
    );

    // NOTE: In production, deliver the activationToken to the patron via secure out-of-band
    // channel (librarian handoff, printed slip, etc.). Email delivery is NOT configured.
    // Do NOT return the token in the API response.

    res.json({
      success: true,
      message: 'Activation token generated. Provide the token to the patron through a secure channel.',
      data: {
        user_id: user.id,
        full_name: user.full_name,
        expires_in_hours: 24
      }
    });
  } catch (error) {
    console.error('Activation token generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate activation token',
      message: error.message
    });
  }
});

module.exports = router;