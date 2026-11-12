const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool, promisePool } = require('../config/database');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');
const { broadcastNewLog } = require('../utils/socketManager');

const borrowBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const userId = req.user?.id || req.body.user_id;
    const { book_id, due_date } = req.body;

    if (!userId || !book_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID and book ID are required'
      });
    }

    await promisePool.query('START TRANSACTION');

    const [books] = await promisePool.query('SELECT * FROM books WHERE id = ? FOR UPDATE', [book_id]);
    if (books.length === 0) {
      await promisePool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    const book = books[0];
    if (book.available_copies <= 0) {
      await promisePool.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'No available copies' });
    }

    const newDueDate = due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [result] = await promisePool.query(
      'INSERT INTO book_transactions (book_id, user_id, transaction_type, borrow_date, due_date, status) VALUES (?, ?, ?, NOW(), ?, ?)',
      [book_id, userId, 'borrow', newDueDate, 'pending']
    );

    await promisePool.query(
      'UPDATE books SET available_copies = available_copies - 1, status = CASE WHEN available_copies - 1 <= 0 THEN \'borrowed\' ELSE \'available\' END WHERE id = ?',
      [book_id]
    );

    const [transaction] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ?', [result.insertId]);
    const [user] = await promisePool.query('SELECT * FROM users WHERE id = ?', [userId]);

    await promisePool.query('COMMIT');

    try {
      broadcastNewLog({
        id: result.insertId,
        user_id: userId,
        user_type: user[0]?.user_type || 'student',
        name: user[0]?.full_name || 'Unknown',
        purpose: 'Borrowing',
        log_type: 'entry',
        timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error broadcasting new log:', logError);
    }

    res.status(201).json({
      success: true,
      data: transaction[0],
      message: 'Borrow request submitted. Waiting for librarian approval.'
    });
  } catch (error) {
    try {
      await promisePool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error borrowing book:', error);
    res.status(500).json({ success: false, error: 'Failed to borrow book', message: error.message });
  }
};

const returnBook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await promisePool.query('START TRANSACTION');

    const [transactions] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ? FOR UPDATE', [id]);
    if (transactions.length === 0) {
      await promisePool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const transaction = transactions[0];
    if (transaction.status === 'returned') {
      await promisePool.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Book already returned' });
    }

    const returnDate = new Date();
    const dueDate = new Date(transaction.due_date);
    const isOverdue = returnDate > dueDate;
    const daysOverdue = Math.floor((returnDate - dueDate) / (1000 * 60 * 60 * 24));
    const fineAmount = isOverdue ? daysOverdue * 5 : 0;

    const updateFields = ['return_date = NOW(), status = ?'];
    const updateParams = [isOverdue ? 'overdue' : 'returned'];

    try {
      const [columns] = await promisePool.query('SHOW COLUMNS FROM book_transactions LIKE ?', ['fine_amount']);
      if (columns.length > 0) {
        updateFields.push('fine_amount = ?');
        updateParams.push(fineAmount);
      }
    } catch (e) {
      console.error('Error checking fine_amount column:', e);
    }

    await promisePool.query(
      `UPDATE book_transactions SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateParams, id]
    );

    const [bookRows] = await promisePool.query('SELECT id FROM books WHERE id = ? FOR UPDATE', [transaction.book_id]);
    if (bookRows.length > 0) {
      await promisePool.query(
        'UPDATE books SET available_copies = available_copies + 1, status = \'available\' WHERE id = ?',
        [transaction.book_id]
      );
    }

    if (fineAmount > 0) {
      await promisePool.query(
        'INSERT INTO fines (user_id, book_id, transaction_id, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
        [transaction.user_id, transaction.book_id, id, fineAmount, `Overdue by ${daysOverdue} day(s)`, 'unpaid']
      );
    }

    await promisePool.query('COMMIT');

    const [updated] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0], message: isOverdue ? `Book returned with fine: ₱${fineAmount}` : 'Book returned successfully' });
  } catch (error) {
    try {
      await promisePool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error returning book:', error);
    res.status(500).json({ success: false, error: 'Failed to return book', message: error.message });
  }
};

const renewBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.body;

    await promisePool.query('START TRANSACTION');

    const [transactions] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ? FOR UPDATE', [id]);
    if (transactions.length === 0) {
      await promisePool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const transaction = transactions[0];
    if (transaction.status !== 'active') {
      await promisePool.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Only active borrows can be renewed' });
    }

    const newDueDate = new Date(transaction.due_date);
    newDueDate.setDate(newDueDate.getDate() + parseInt(days));

    await promisePool.query(
      'UPDATE book_transactions SET due_date = ?, renewed = COALESCE(renewed, 0) + 1 WHERE id = ?',
      [newDueDate.toISOString().slice(0, 10), id]
    );

    await promisePool.query('COMMIT');

    const [updated] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0], message: `Book renewed. New due date: ${newDueDate.toISOString().slice(0, 10)}` });
  } catch (error) {
    try {
      await promisePool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error renewing book:', error);
    res.status(500).json({ success: false, error: 'Failed to renew book', message: error.message });
  }
};

const approveTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    await promisePool.query('START TRANSACTION');

    const [transactions] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ? FOR UPDATE', [id]);
    if (transactions.length === 0) {
      await promisePool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    await promisePool.query('UPDATE book_transactions SET status = \'active\' WHERE id = ?', [id]);

    await promisePool.query('COMMIT');

    const [updated] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0], message: 'Borrow request approved' });
  } catch (error) {
    try {
      await promisePool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error approving transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to approve', message: error.message });
  }
};

const rejectTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await promisePool.query('START TRANSACTION');

    const [transactions] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ? FOR UPDATE', [id]);
    if (transactions.length === 0) {
      await promisePool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const transaction = transactions[0];

    await promisePool.query(
      'UPDATE book_transactions SET status = \'cancelled\', notes = ? WHERE id = ?',
      [reason || 'Rejected by librarian', id]
    );

    await promisePool.query(
      'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
      [transaction.book_id]
    );

    await promisePool.query('COMMIT');

    const [updated] = await promisePool.query('SELECT * FROM book_transactions WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0], message: 'Borrow request rejected' });
  } catch (error) {
    try {
      await promisePool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error rejecting transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to reject', message: error.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { status, user_id, book_id, transaction_type, page = 1, limit = 20 } = req.query;
    let query = 'SELECT bt.*, b.title, b.author, u.full_name, u.student_id FROM book_transactions bt JOIN books b ON bt.book_id = b.id JOIN users u ON bt.user_id = u.id WHERE 1=1';
    const params = [];

    if (status) { query += ' AND bt.status = ?'; params.push(status); }
    if (user_id) { query += ' AND bt.user_id = ?'; params.push(user_id); }
    if (book_id) { query += ' AND bt.book_id = ?'; params.push(book_id); }
    if (transaction_type) { query += ' AND bt.transaction_type = ?'; params.push(transaction_type); }

    query += ' ORDER BY bt.created_at DESC';
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const [transactions] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);
    const [countResult] = await promisePool.query('SELECT COUNT(*) as total FROM book_transactions bt WHERE 1=1' + (status ? ' AND bt.status = ?' : '') + (user_id ? ' AND bt.user_id = ?' : ''), params.filter((_, i) => status || user_id ? true : false));

    res.json({
      success: true,
      data: transactions,
      pagination: { total: countResult[0]?.total || 0, page: pageNum, limit: limitNum, pages: Math.ceil((countResult[0]?.total || 0) / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions', message: error.message });
  }
};

const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const [transactions] = await promisePool.query(
      'SELECT bt.*, b.title, b.author, b.isbn FROM book_transactions bt JOIN books b ON bt.book_id = b.id WHERE bt.user_id = ? ORDER BY bt.created_at DESC',
      [userId]
    );

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching my transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions', message: error.message });
  }
};

const createReservation = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    const { book_id, preferred_date, notes } = req.body;

    if (!userId || !book_id) {
      return res.status(400).json({ success: false, error: 'User ID and book ID are required' });
    }

    const [result] = await promisePool.query(
      'INSERT INTO reservations (user_id, book_id, preferred_date, notes, status) VALUES (?, ?, ?, ?, ?)',
      [userId, book_id, preferred_date || null, notes || null, 'pending']
    );

    const [reservation] = await promisePool.query('SELECT * FROM reservations WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: reservation[0], message: 'Reservation request submitted' });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ success: false, error: 'Failed to create reservation', message: error.message });
  }
};

const getMyReservations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const [reservations] = await promisePool.query(
      'SELECT r.*, b.title, b.author FROM reservations r JOIN books b ON r.book_id = b.id WHERE r.user_id = ? ORDER BY r.created_at DESC',
      [userId]
    );

    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reservations', message: error.message });
  }
};

const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const [result] = await promisePool.query('UPDATE reservations SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const [reservation] = await promisePool.query('SELECT * FROM reservations WHERE id = ?', [id]);
    res.json({ success: true, data: reservation[0], message: `Reservation ${status}` });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ success: false, error: 'Failed to update reservation', message: error.message });
  }
};

const createFine = async (req, res) => {
  try {
    const { user_id, book_id, transaction_id, amount, reason } = req.body;

    if (!user_id || !amount) {
      return res.status(400).json({ success: false, error: 'User ID and amount are required' });
    }

    const [result] = await promisePool.query(
      'INSERT INTO fines (user_id, book_id, transaction_id, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, book_id || null, transaction_id || null, amount, reason || 'Overdue fine', 'unpaid']
    );

    const [fine] = await promisePool.query('SELECT * FROM fines WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: fine[0], message: 'Fine created' });
  } catch (error) {
    console.error('Error creating fine:', error);
    res.status(500).json({ success: false, error: 'Failed to create fine', message: error.message });
  }
};

const getFines = async (req, res) => {
  try {
    const { user_id, status, page = 1, limit = 20 } = req.query;
    let query = 'SELECT f.*, u.full_name, u.student_id, b.title as book_title FROM fines f JOIN users u ON f.user_id = u.id LEFT JOIN books b ON f.book_id = b.id WHERE 1=1';
    const params = [];

    if (user_id) { query += ' AND f.user_id = ?'; params.push(user_id); }
    if (status) { query += ' AND f.status = ?'; params.push(status); }

    query += ' ORDER BY f.created_at DESC';
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const [fines] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);
    const [countResult] = await promisePool.query('SELECT COUNT(*) as total FROM fines WHERE 1=1' + (user_id ? ' AND user_id = ?' : '') + (status ? ' AND status = ?' : ''), params.filter((_, i) => user_id || status ? true : false));

    res.json({
      success: true,
      data: fines,
      pagination: { total: countResult[0]?.total || 0, page: pageNum, limit: limitNum, pages: Math.ceil((countResult[0]?.total || 0) / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching fines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fines', message: error.message });
  }
};

const clearFine = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await promisePool.query('UPDATE fines SET status = ? WHERE id = ?', ['paid', id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Fine not found' });
    }
    const [fine] = await promisePool.query('SELECT * FROM fines WHERE id = ?', [id]);
    res.json({ success: true, data: fine[0], message: 'Fine marked as paid' });
  } catch (error) {
    console.error('Error clearing fine:', error);
    res.status(500).json({ success: false, error: 'Failed to clear fine', message: error.message });
  }
};

const waiveFine = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [result] = await promisePool.query('UPDATE fines SET status = ?, paid_at = NOW(), reason = COALESCE(?, reason) WHERE id = ?', ['waived', reason || 'Waived by admin', id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Fine not found' });
    }
    const [fine] = await promisePool.query('SELECT * FROM fines WHERE id = ?', [id]);
    res.json({ success: true, data: fine[0], message: 'Fine waived successfully' });
  } catch (error) {
    console.error('Error waiving fine:', error);
    res.status(500).json({ success: false, error: 'Failed to waive fine', message: error.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.user_type;

    let notifications = [];
    if (userType === 'admin' || userType === 'librarian') {
      const [pendingBorrows] = await promisePool.query('SELECT COUNT(*) as count FROM book_transactions WHERE status = \'pending\'');
      const [pendingReservations] = await promisePool.query('SELECT COUNT(*) as count FROM reservations WHERE status = \'pending\'');
      const [unpaidFines] = await promisePool.query('SELECT COUNT(*) as count FROM fines WHERE status = \'unpaid\'');
      notifications = [
        { id: 1, type: 'borrow', message: `${pendingBorrows[0].count} pending borrow request(s)`, count: pendingBorrows[0].count },
        { id: 2, type: 'reservation', message: `${pendingReservations[0].count} pending reservation(s)`, count: pendingReservations[0].count },
        { id: 3, type: 'fine', message: `${unpaidFines[0].count} unpaid fine(s)`, count: unpaidFines[0].count }
      ];
    } else if (userId) {
      const [pendingBorrows] = await promisePool.query('SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = \'pending\'', [userId]);
      const [activeBorrows] = await promisePool.query('SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = \'active\'', [userId]);
      const [overdueFines] = await promisePool.query('SELECT COUNT(*) as count FROM fines WHERE user_id = ? AND status = \'unpaid\'', [userId]);
      notifications = [
        { id: 1, type: 'pending', message: `${pendingBorrows[0].count} pending borrow request(s)`, count: pendingBorrows[0].count },
        { id: 2, type: 'active', message: `${activeBorrows[0].count} active borrow(s)`, count: activeBorrows[0].count },
        { id: 3, type: 'fine', message: `${overdueFines[0].count} unpaid fine(s)`, count: overdueFines[0].count }
      ];
    }

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications', message: error.message });
  }
};

router.post('/borrow', authenticateToken, borrowBook);
router.post('/return/:id', authenticateToken, returnBook);
router.post('/renew/:id', authenticateToken, renewBook);
router.post('/reserve', authenticateToken, createReservation);
router.get('/my/transactions', authenticateToken, getMyTransactions);
router.get('/my/reservations', authenticateToken, getMyReservations);
router.get('/notifications', authenticateToken, getNotifications);

router.get('/transactions', authenticateToken, getTransactions);
router.post('/transactions/:id/approve', authenticateToken, approveTransaction);
router.post('/transactions/:id/reject', authenticateToken, rejectTransaction);
router.post('/fines', authenticateToken, createFine);
router.get('/fines', authenticateToken, getFines);
router.post('/fines/:id/clear', authenticateToken, clearFine);
router.post('/fines/:id/waive', authenticateToken, requireRole('admin', 'librarian'), waiveFine);
router.post('/reservations/:id/status', authenticateToken, updateReservationStatus);

module.exports = router;
