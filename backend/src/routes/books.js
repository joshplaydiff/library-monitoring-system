const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const getBooks = async (req, res) => {
  try {
    const { search, genre, status, page, limit } = req.query;

    let query = 'SELECT * FROM books WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (genre) {
      query += ' AND genre = ?';
      params.push(genre);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const [books] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);

    const [countResult] = await promisePool.query(
      'SELECT COUNT(*) as total FROM books WHERE 1=1' +
      (search ? ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)' : '') +
      (genre ? ' AND genre = ?' : '') +
      (status ? ' AND status = ?' : ''),
      [
        search ? `%${search}%` : null,
        search ? `%${search}%` : null,
        search ? `%${search}%` : null,
        genre || null,
        status || null
      ].filter(Boolean)
    );

    res.json({
      success: true,
      data: books,
      pagination: {
        total: countResult[0]?.total || 0,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((countResult[0]?.total || 0) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch books',
      message: error.message
    });
  }
};

const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    const [books] = await promisePool.query('SELECT * FROM books WHERE id = ?', [id]);

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    res.json({
      success: true,
      data: books[0]
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch book',
      message: error.message
    });
  }
};

const createBook = async (req, res) => {
  try {
    const { title, author, isbn, genre, copies, available_copies, status } = req.body;

    if (!title || !author) {
      return res.status(400).json({
        success: false,
        error: 'Title and author are required'
      });
    }

    const [result] = await promisePool.query(
      'INSERT INTO books (title, author, isbn, genre, copies, available_copies, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, author, isbn || null, genre || null, copies || 1, available_copies || copies || 1, status || 'available']
    );

    const [newBook] = await promisePool.query('SELECT * FROM books WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: newBook[0]
    });
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create book',
      message: error.message
    });
  }
};

const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const allowedFields = ['title', 'author', 'isbn', 'genre', 'copies', 'available_copies', 'status'];
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
      `UPDATE books SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    const [updatedBook] = await promisePool.query('SELECT * FROM books WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updatedBook[0]
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update book',
      message: error.message
    });
  }
};

const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await promisePool.query('DELETE FROM books WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete book',
      message: error.message
    });
  }
};

router.get('/', getBooks);
router.get('/:id', getBookById);
router.post('/', authenticateToken, createBook);
router.put('/:id', authenticateToken, updateBook);
router.delete('/:id', authenticateToken, deleteBook);

module.exports = router;