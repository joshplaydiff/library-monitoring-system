/**
 * Attendance Service - Reusable service for attendance processing.
 * Used by both the QR scan route (POST /api/logs/scan) and
 * the sync-batch route (POST /api/logs/sync-batch).
 * 
 * All functions operate within a provided MySQL connection/transaction
 * to ensure consistency between online scans and offline sync.
 */

const { promisePool } = require('../config/database');

/**
 * Resolve a patron from official_id + id_classification.
 * Returns the user record or null if not found.
 */
async function resolvePatron(connection, official_id, id_type) {
  const [users] = await connection.query(
    'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department FROM users WHERE official_id = ? AND id_classification = ?',
    [official_id, id_type]
  );
  if (users.length === 0) return null;
  return users[0];
}

/**
 * Determine if a patron has an active entry session (entry without subsequent exit).
 * Uses deterministic ID ordering (not timestamp) to handle same-second scans.
 */
async function hasActiveSession(connection, userId) {
  const [latestEntry] = await connection.query(
    `SELECT id FROM visit_logs WHERE user_id = ? AND log_type = 'entry' ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (latestEntry.length === 0) return false;

  const [subsequentExit] = await connection.query(
    `SELECT id FROM visit_logs WHERE user_id = ? AND log_type = 'exit' AND id > ? ORDER BY id ASC LIMIT 1`,
    [userId, latestEntry[0].id]
  );
  return subsequentExit.length === 0;
}

/**
 * Insert an attendance record with server-generated timestamp.
 * Returns the inserted row.
 */
async function insertAttendanceRecord(connection, patron, purpose, section, room_id, log_type, client_event_id, timestamp) {
  const [result] = await connection.query(
    `INSERT INTO visit_logs
       (user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      patron.id,
      patron.user_type,
      patron.full_name,
      purpose || 'General',
      section || 'Main Library',
      room_id || null,
      log_type,
      timestamp || new Date().toISOString().slice(0, 19).replace('T', ' '),
      client_event_id
    ]
  );
  return result.insertId;
}

/**
 * Check if a client_event_id already exists (idempotency check).
 * Returns the existing record or null.
 */
async function findExistingEvent(connection, client_event_id) {
  const [existing] = await connection.query(
    'SELECT id, user_id, log_type, timestamp, section, room_id, purpose FROM visit_logs WHERE client_event_id = ?',
    [client_event_id]
  );
  return existing.length > 0 ? existing[0] : null;
}

/**
 * Process a single attendance scan within a transaction.
 * Returns { success, data, error, status } where status is one of:
 *   'synced' - new record created
 *   'previously_synced' - same event ID, same data
 *   'needs_review' - same event ID, conflicting data
 *   'rejected' - patron not found or other error
 */
async function processScan(connection, {
  client_event_id,
  official_id,
  id_type,
  purpose,
  section,
  room_id,
  log_type,
  timestamp
}) {
  // Idempotency check
  const existing = await findExistingEvent(connection, client_event_id);
  if (existing) {
    const isSameData =
      existing.purpose === (purpose || 'General') &&
      existing.section === (section || 'Main Library');

    if (isSameData) {
      return {
        success: true,
        status: 'previously_synced',
        data: {
          client_event_id,
          id: existing.id,
          log_type: existing.log_type,
          timestamp: existing.timestamp,
          section: existing.section,
          room_id: existing.room_id
        }
      };
    } else {
      return {
        success: false,
        status: 'needs_review',
        data: {
          client_event_id,
          official_id,
          id_type,
          reason: 'Conflicting data for same event ID',
          original: { purpose: existing.purpose, section: existing.section },
          submitted: { purpose: purpose || 'General', section: section || 'Main Library' }
        }
      };
    }
  }

  // Resolve patron
  const patron = await resolvePatron(connection, official_id, id_type);
  if (!patron) {
    return {
      success: false,
      status: 'rejected',
      data: {
        client_event_id,
        official_id,
        id_type,
        reason: 'Patron not found. Register patron first.'
      }
    };
  }

  // Determine entry/exit
  const activeSession = await hasActiveSession(connection, patron.id);
  let logType = log_type;
  if (activeSession) {
    logType = 'exit';
  }

  // Insert record
  const insertId = await insertAttendanceRecord(
    connection,
    patron,
    purpose,
    section,
    room_id,
    log_type,
    client_event_id,
    timestamp
  );

  return {
    success: true,
    status: 'synced',
    data: {
      client_event_id,
      id: insertId,
      official_id: patron.official_id,
      id_type: patron.id_classification,
      name: patron.full_name,
      user_type: patron.user_type,
      purpose: purpose || 'General',
      section: section || 'Main Library',
      room_id: room_id || null,
      log_type: logType,
      timestamp: timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ')
    }
  };
}

module.exports = {
  resolvePatron,
  hasActiveSession,
  insertAttendanceRecord,
  findExistingEvent,
  processScan
};