const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const validateCatalogRecord = [
  body('title').notEmpty().withMessage('Title is required'),
  body('author').notEmpty().withMessage('Author is required'),
  body('isbn').optional({ nullable: true }).isLength({ min: 10, max: 17 }).withMessage('Invalid ISBN'),
  body('local_call_number').optional({ nullable: true }).notEmpty(),
  body('accession_number').optional({ nullable: true }).notEmpty(),
];

// Create catalog record
router.post('/', authenticateToken, requireRole('admin', 'librarian'), validateCatalogRecord, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const [result] = await promisePool.query(
      `INSERT INTO catalog_records (
        title, author, author_type, added_author, editor,
        publisher, publication_place, publication_date, edition,
        pages, illustrations, dimensions,
        series_title, series_volume, series_issue,
        isbn, issn, oclc_number, local_call_number, accession_number,
        subject_headings, keywords, dewey_decimal, library_of_congress,
        general_notes, bibliography_notes, table_of_contents, summary,
        material_type, language,
        cataloging_source, cataloger, cataloging_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.title,
        req.body.author,
        req.body.author_type || 'personal',
        req.body.added_author || null,
        req.body.editor || null,
        req.body.publisher || null,
        req.body.publication_place || null,
        req.body.publication_date || null,
        req.body.edition || null,
        req.body.pages || null,
        req.body.illustrations || null,
        req.body.dimensions || null,
        req.body.series_title || null,
        req.body.series_volume || null,
        req.body.series_issue || null,
        req.body.isbn || null,
        req.body.issn || null,
        req.body.oclc_number || null,
        req.body.local_call_number || null,
        req.body.accession_number || null,
        req.body.subject_headings || null,
        req.body.keywords || null,
        req.body.dewey_decimal || null,
        req.body.library_of_congress || null,
        req.body.general_notes || null,
        req.body.bibliography_notes || null,
        req.body.table_of_contents || null,
        req.body.summary || null,
        req.body.material_type || 'book',
        req.body.language || 'English',
        req.body.cataloging_source || 'UST-Legazpi Library',
        req.body.cataloger || (req.user && req.user.full_name) || null,
        req.body.cataloging_date || new Date().toISOString().slice(0, 10)
      ]
    );

    const [record] = await promisePool.query('SELECT * FROM catalog_records WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: record[0] });
  } catch (error) {
    console.error('Error creating catalog record:', error);
    const message = error && error.message ? error.message : 'Failed to create catalog record';
    res.status(500).json({ success: false, error: message });
  }
});

// Get all catalog records with search/filter
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, author, subject, material_type, status, dewey_decimal, page = 1, limit = 20 } = req.query;

    let query = 'SELECT * FROM catalog_records WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (title LIKE ? OR author LIKE ? OR subject_headings LIKE ? OR keywords LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (author) {
      query += ' AND author LIKE ?';
      params.push(`%${author}%`);
    }
    if (subject) {
      query += ' AND (subject_headings LIKE ? OR keywords LIKE ?)';
      params.push(`%${subject}%`, `%${subject}%`);
    }
    if (material_type) {
      query += ' AND material_type = ?';
      params.push(material_type);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (dewey_decimal) {
      query += ' AND dewey_decimal LIKE ?';
      params.push(`%${dewey_decimal}%`);
    }

    query += ' ORDER BY title ASC';
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const [records] = await promisePool.query(query + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);

    const countParams = [];
    let countQuery = 'SELECT COUNT(*) as total FROM catalog_records WHERE 1=1';
    if (search) {
      countQuery += ' AND (title LIKE ? OR author LIKE ? OR subject_headings LIKE ? OR keywords LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (author) {
      countQuery += ' AND author LIKE ?';
      countParams.push(`%${author}%`);
    }
    if (subject) {
      countQuery += ' AND (subject_headings LIKE ? OR keywords LIKE ?)';
      countParams.push(`%${subject}%`, `%${subject}%`);
    }
    if (material_type) {
      countQuery += ' AND material_type = ?';
      countParams.push(material_type);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (dewey_decimal) {
      countQuery += ' AND dewey_decimal LIKE ?';
      countParams.push(`%${dewey_decimal}%`);
    }

    const [countResult] = await promisePool.query(countQuery, countParams);

    res.json({
      success: true,
      data: records,
      pagination: { total: countResult[0]?.total || 0, page: pageNum, limit: limitNum, pages: Math.ceil((countResult[0]?.total || 0) / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching catalog records:', error);
    const message = error && error.message ? error.message : 'Failed to fetch catalog records';
    res.status(500).json({ success: false, error: message });
  }
});

// Get single catalog record
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [records] = await promisePool.query('SELECT * FROM catalog_records WHERE id = ?', [id]);

    if (records.length === 0) {
      return res.status(404).json({ success: false, error: 'Catalog record not found' });
    }

    res.json({ success: true, data: records[0] });
  } catch (error) {
    console.error('Error fetching catalog record:', error);
    const message = error && error.message ? error.message : 'Failed to fetch catalog record';
    res.status(500).json({ success: false, error: message });
  }
});

// Update catalog record
router.put('/:id', authenticateToken, requireRole('admin', 'librarian'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const allowedFields = [
      'title', 'author', 'author_type', 'added_author', 'editor',
      'publisher', 'publication_place', 'publication_date', 'edition',
      'pages', 'illustrations', 'dimensions',
      'series_title', 'series_volume', 'series_issue',
      'isbn', 'issn', 'oclc_number', 'local_call_number', 'accession_number',
      'subject_headings', 'keywords', 'dewey_decimal', 'library_of_congress',
      'general_notes', 'bibliography_notes', 'table_of_contents', 'summary',
      'material_type', 'language', 'status', 'copies_total', 'copies_available',
      'cataloging_source', 'cataloger', 'last_revision_date', 'revision_note'
    ];

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await promisePool.query(`UPDATE catalog_records SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updated] = await promisePool.query('SELECT * FROM catalog_records WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating catalog record:', error);
    const message = error && error.message ? error.message : 'Failed to update catalog record';
    res.status(500).json({ success: false, error: message });
  }
});

// Delete catalog record
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await promisePool.query('DELETE FROM catalog_records WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Catalog record not found' });
    }

    res.json({ success: true, message: 'Catalog record deleted successfully' });
  } catch (error) {
    console.error('Error deleting catalog record:', error);
    const message = error && error.message ? error.message : 'Failed to delete catalog record';
    res.status(500).json({ success: false, error: message });
  }
});

// Get catalog statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const [stats] = await promisePool.query(`
      SELECT
        COUNT(*) as total_records,
        SUM(copies_total) as total_copies,
        SUM(copies_available) as available_copies,
        COUNT(DISTINCT author) as unique_authors,
        COUNT(DISTINCT material_type) as material_types
      FROM catalog_records
      WHERE status != 'withdrawn'
    `);

    const [byType] = await promisePool.query(`
      SELECT material_type, COUNT(*) as count, SUM(copies_total) as total_copies
      FROM catalog_records
      WHERE status != 'withdrawn'
      GROUP BY material_type
    `);

    const [byStatus] = await promisePool.query(`
      SELECT status, COUNT(*) as count
      FROM catalog_records
      GROUP BY status
    `);

    res.json({ success: true, data: { overview: stats[0], by_material_type: byType, by_status: byStatus } });
  } catch (error) {
    console.error('Error fetching catalog stats:', error);
    const message = error && error.message ? error.message : 'Failed to fetch catalog statistics';
    res.status(500).json({ success: false, error: message });
  }
});

module.exports = router;
