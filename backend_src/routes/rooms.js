const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const getRooms = async (req, res) => {
  try {
    const { library, floor, room_type, status, section, page, limit } = req.query;

    let query = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (library) {
      query += ' AND library = ?';
      params.push(library);
    }

    if (floor) {
      query += ' AND floor = ?';
      params.push(floor);
    }

    if (room_type) {
      query += ' AND room_type = ?';
      params.push(room_type);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }

    query += ' ORDER BY created_at DESC';

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const [rooms] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);

    const [countResult] = await promisePool.query(
      'SELECT COUNT(*) as total FROM rooms WHERE 1=1' +
      (library ? ' AND library = ?' : '') +
      (floor ? ' AND floor = ?' : '') +
      (room_type ? ' AND room_type = ?' : '') +
      (status ? ' AND status = ?' : '') +
      (section ? ' AND section = ?' : ''),
      [library, floor, room_type, status, section].filter(Boolean)
    );

    res.json({
      success: true,
      data: rooms,
      pagination: {
        total: countResult[0]?.total || 0,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((countResult[0]?.total || 0) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
      message: error.message
    });
  }
};

const createRoom = async (req, res) => {
  try {
    const { room_name, library, floor, room_type, capacity, status, section } = req.body;

    if (!room_name || !library) {
      return res.status(400).json({
        success: false,
        error: 'Room name and library are required'
      });
    }

    const [result] = await promisePool.query(
      'INSERT INTO rooms (room_name, library, floor, room_type, capacity, status, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [room_name, library, floor || null, room_type || 'study', capacity || 10, status || 'available', section || null]
    );

    const [newRoom] = await promisePool.query('SELECT * FROM rooms WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: newRoom[0]
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create room',
      message: error.message
    });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const allowedFields = ['room_name', 'library', 'floor', 'room_type', 'capacity', 'status', 'section'];
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
      `UPDATE rooms SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    const [updatedRoom] = await promisePool.query('SELECT * FROM rooms WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updatedRoom[0]
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update room',
      message: error.message
    });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await promisePool.query('DELETE FROM rooms WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete room',
      message: error.message
    });
  }
};

router.get('/', getRooms);
router.post('/', authenticateToken, createRoom);
router.put('/:id', authenticateToken, updateRoom);
router.delete('/:id', authenticateToken, deleteRoom);

module.exports = router;