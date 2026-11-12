const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const getRoomReservations = async (req, res) => {
  try {
    const { room_id, user_id, status, date, page = 1, limit = 20 } = req.query;
    let query = 'SELECT rr.*, r.room_name, r.library, r.section, u.full_name, u.student_id FROM room_reservations rr JOIN rooms r ON rr.room_id = r.id JOIN users u ON rr.user_id = u.id WHERE 1=1';
    const params = [];

    if (room_id) { query += ' AND rr.room_id = ?'; params.push(room_id); }
    if (user_id) { query += ' AND rr.user_id = ?'; params.push(user_id); }
    if (status) { query += ' AND rr.status = ?'; params.push(status); }
    if (date) { query += ' AND rr.reservation_date = ?'; params.push(date); }

    query += ' ORDER BY rr.reservation_date DESC, rr.start_time ASC';
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const [reservations] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);
    const [countResult] = await promisePool.query('SELECT COUNT(*) as total FROM room_reservations WHERE 1=1' + (room_id ? ' AND room_id = ?' : '') + (user_id ? ' AND user_id = ?' : '') + (status ? ' AND status = ?' : '') + (date ? ' AND reservation_date = ?' : ''), params);

    res.json({
      success: true,
      data: reservations,
      pagination: { total: countResult[0]?.total || 0, page: pageNum, limit: limitNum, pages: Math.ceil((countResult[0]?.total || 0) / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching room reservations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch room reservations', message: error.message });
  }
};

const createRoomReservation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const userId = req.user?.id;
    const { room_id, purpose, reservation_date, start_time, end_time } = req.body;

    if (!room_id || !reservation_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Room, date, start time, and end time are required' });
    }

    const [rooms] = await promisePool.query('SELECT * FROM rooms WHERE id = ?', [room_id]);
    if (rooms.length === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const [conflicts] = await promisePool.query(
      'SELECT * FROM room_reservations WHERE room_id = ? AND reservation_date = ? AND status = \'approved\' AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))',
      [room_id, reservation_date, end_time, start_time, start_time, end_time]
    );
    if (conflicts.length > 0) {
      return res.status(400).json({ success: false, error: 'Room is already reserved for this time slot' });
    }

    const [result] = await promisePool.query(
      'INSERT INTO room_reservations (room_id, user_id, purpose, reservation_date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [room_id, userId, purpose || null, reservation_date, start_time, end_time, 'pending']
    );

    const [reservation] = await promisePool.query('SELECT * FROM room_reservations WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: reservation[0], message: 'Room reservation submitted for approval' });
  } catch (error) {
    console.error('Error creating room reservation:', error);
    res.status(500).json({ success: false, error: 'Failed to create reservation', message: error.message });
  }
};

const updateRoomReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const [result] = await promisePool.query(
      'UPDATE room_reservations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [status, req.user?.id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const [updated] = await promisePool.query('SELECT * FROM room_reservations WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0], message: `Reservation ${status}` });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ success: false, error: 'Failed to update reservation', message: error.message });
  }
};

const cancelRoomReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const [reservations] = await promisePool.query('SELECT * FROM room_reservations WHERE id = ?', [id]);
    if (reservations.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const reservation = reservations[0];
    if (reservation.user_id !== userId && !['admin', 'librarian'].includes(req.user?.user_type)) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this reservation' });
    }

    if (['cancelled', 'rejected'].includes(reservation.status)) {
      return res.status(400).json({ success: false, error: 'Reservation is already cancelled or rejected' });
    }

    const [result] = await promisePool.query('UPDATE room_reservations SET status = \'cancelled\' WHERE id = ?', [id]);
    res.json({ success: true, message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel reservation', message: error.message });
  }
};

const getMyRoomReservations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [reservations] = await promisePool.query(
      'SELECT rr.*, r.room_name, r.library, r.section FROM room_reservations rr JOIN rooms r ON rr.room_id = r.id WHERE rr.user_id = ? ORDER BY rr.reservation_date DESC',
      [userId]
    );
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Error fetching my room reservations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reservations', message: error.message });
  }
};

router.get('/', authenticateToken, getRoomReservations);
router.post('/', authenticateToken, createRoomReservation);
router.put('/:id/status', authenticateToken, requireRole('admin', 'librarian'), updateRoomReservationStatus);
router.delete('/:id', authenticateToken, cancelRoomReservation);
router.get('/my', authenticateToken, getMyRoomReservations);

module.exports = router;
