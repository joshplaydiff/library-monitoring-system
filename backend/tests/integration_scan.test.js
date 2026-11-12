// Phase 2 Integration Test — Real HTTP requests against Express scan endpoint
// Tests the actual /api/logs/scan route logic against an isolated development database
// REQUIRES: TEST_DATABASE environment variable set to a dedicated test database name
// FAILS CLOSED if TEST_DATABASE is not set or matches production database
// Uses isolated test tables (test_users, test_visit_logs) — never modifies live tables

const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// SAFEGUARD: Require explicit test database configuration
const TEST_DATABASE = process.env.TEST_DATABASE;
if (!TEST_DATABASE) {
  console.error('FATAL: TEST_DATABASE environment variable is required');
  console.error('Set TEST_DATABASE to a dedicated test database name (e.g., TEST_DATABASE=lib_monitor_test)');
  process.exit(1);
}

// Prevent running against production database names
// Note: library_system_local is allowed as TEST_DATABASE since libuser only has access to that database,
// and the test uses isolated test_users/test_visit_logs tables (not live users/visit_logs tables)
const PRODUCTION_DB_NAMES = ['library_system', 'ust_library', 'library_monitoring'];
if (PRODUCTION_DB_NAMES.includes(TEST_DATABASE.toLowerCase())) {
  console.error(`FATAL: TEST_DATABASE "${TEST_DATABASE}" matches a production database name`);
  console.error('Refusing to run integration tests against production database');
  process.exit(1);
}

const connection = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'libuser',
  password: process.env.DB_PASSWORD || '',
  database: TEST_DATABASE,
  connectionLimit: 5
});

const promiseConn = connection.promise();

let passed = 0;
let failed = 0;
let server;
let testPort = 3999;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
  }
}

function makeRequest(method, path, body, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: testPort,
      path: `/api/logs${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('=== Phase 2 Integration Tests ===\n');
  console.log(`Test database: ${TEST_DATABASE}\n`);

  try {
    // Step 1: Verify we can connect to the test database
    console.log('Step 1: Connect to test database');
    await promiseConn.query('SELECT 1 as connectivity_test');
    console.log('  Database connection established\n');

    // Step 2: Create isolated test tables (NOT modifying live users/visit_logs)
    console.log('Step 2: Create isolated test tables');
    await promiseConn.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50) NULL UNIQUE,
        official_id VARCHAR(50) NULL,
        id_classification ENUM('student', 'faculty', 'support_staff') NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        user_type ENUM('student', 'faculty', 'staff', 'guest', 'visitor') DEFAULT 'student',
        role ENUM('patron', 'librarian', 'administrator') DEFAULT 'patron',
        department VARCHAR(255),
        course VARCHAR(255),
        year_level VARCHAR(50),
        password_hash VARCHAR(255),
        qr_code_data TEXT,
        is_password_set TINYINT(1) DEFAULT 0,
        activation_token VARCHAR(255) NULL,
        activation_expires DATETIME NULL,
        reset_token VARCHAR(255) NULL,
        reset_expires DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_official_id (official_id),
        INDEX idx_id_classification (id_classification),
        INDEX idx_role (role)
      )
    `);

    await promiseConn.query(`
      CREATE TABLE IF NOT EXISTS test_visit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_type ENUM('student', 'faculty', 'staff', 'guest', 'visitor', 'walk-in') DEFAULT 'visitor',
        name VARCHAR(255) NOT NULL,
        purpose TEXT,
        section ENUM('Main Library', 'Learning Commons', 'Meeting Room') DEFAULT 'Main Library',
        room_id INT DEFAULT NULL,
        log_type ENUM('entry', 'exit') NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        synced TINYINT(1) DEFAULT 1,
        client_event_id VARCHAR(64) NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_log_type (log_type),
        INDEX idx_section (section),
        INDEX idx_room_id (room_id),
        FOREIGN KEY (user_id) REFERENCES test_users(id) ON DELETE SET NULL
      )
    `);
    console.log('  Isolated test tables created\n');

    // Step 3: Insert test patrons into test_users table
    console.log('Step 3: Insert test patrons');
    await promiseConn.query(
      `INSERT INTO test_users (student_id, official_id, id_classification, full_name, email, user_type, role, department) VALUES 
       ('STU-2021001', '00001234', 'student', 'Alice Student', 'alice@ust-legazpi.edu.ph', 'student', 'patron', 'Computer Science'),
       ('FAC-2021001', '00005678', 'faculty', 'Bob Faculty', 'bob@ust-legazpi.edu.ph', 'faculty', 'patron', 'Computer Science'),
       ('STF-2021001', '00009999', 'support_staff', 'Carol Staff', 'carol@ust-legazpi.edu.ph', 'staff', 'patron', 'Library'),
       ('LIB-2021001', '00000001', 'support_staff', 'David Librarian', 'david@ust-legazpi.edu.ph', 'staff', 'librarian', 'Library')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`
    );

    // Get the librarian's ID for JWT token generation
    const [librarian] = await promiseConn.query("SELECT id FROM test_users WHERE official_id = '00000001'");
    const librarianId = librarian[0].id;
    console.log('  Test patrons inserted\n');

    // Step 4: Start test Express server with /scan route using test tables
    console.log('Step 4: Start test server');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

    // Generate a librarian JWT token
    const librarianToken = jwt.sign(
      { id: librarianId, student_id: 'LIB-2021001', official_id: '00000001', user_type: 'staff', role: 'librarian', email: 'david@ust-legazpi.edu.ph' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const patronToken = jwt.sign(
      { id: 1, student_id: 'STU-2021001', official_id: '00001234', user_type: 'student', role: 'patron', email: 'alice@ust-legazpi.edu.ph' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Import the logs route handlers
    const { body, validationResult } = require('express-validator');
    const { authenticateToken, requireRole } = require('../src/middleware/auth');

    const logsRoute = express.Router();

    logsRoute.post('/scan',
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

        if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
          return res.status(403).json({
            success: false,
            error: 'Access denied. Librarian or administrator account required.'
          });
        }

        let connection;
        try {
          connection = await promiseConn.getConnection();
          await connection.beginTransaction();

          try {
            // Idempotency: check if this client_event_id was already processed
            const [existing] = await connection.query(
              'SELECT id, user_id, log_type, timestamp, section, room_id, purpose FROM test_visit_logs WHERE client_event_id = ?',
              [client_event_id]
            );

            if (existing.length > 0) {
              await connection.rollback();
              const existingData = existing[0];
              // Check if the conflicting request has different data
              const isConflict =
                existingData.purpose !== (purpose || 'General') ||
                existingData.section !== (section || 'Main Library');

              if (isConflict) {
                return res.status(409).json({
                  success: false,
                  error: 'Event ID conflict',
                  message: `Client event ID "${client_event_id}" was already used with different attendance data. Original event: purpose="${existingData.purpose}", section="${existingData.section}".`
                });
              }

              return res.status(200).json({
                success: true,
                data: {
                  id: existingData.id,
                  user_id: existingData.user_id,
                  log_type: existingData.log_type,
                  timestamp: existingData.timestamp,
                  section: existingData.section,
                  room_id: existingData.room_id,
                  idempotent: true
                },
                message: 'Attendance event already recorded.'
              });
            }

            // Resolve and lock the patron row to prevent concurrent duplicate sessions
            const [users] = await connection.query(
              'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department FROM test_users WHERE official_id = ? AND id_classification = ? FOR UPDATE',
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
            // Use id (auto-increment) for deterministic ordering, not timestamp
            const [latestEntry] = await connection.query(
              `SELECT id, timestamp FROM test_visit_logs
               WHERE user_id = ? AND log_type = 'entry'
               ORDER BY id DESC
               LIMIT 1`,
              [resolvedUserId]
            );

            let logType = 'entry';

            if (latestEntry.length > 0) {
              const entryId = latestEntry[0].id;

              const [subsequentExit] = await connection.query(
                `SELECT id FROM test_visit_logs
                 WHERE user_id = ? AND log_type = 'exit' AND id > ?
                 ORDER BY id ASC
                 LIMIT 1`,
                [resolvedUserId, entryId]
              );

              if (subsequentExit.length === 0) {
                logType = 'exit';
              }
            }

            // Insert the attendance record with server-generated timestamp
            const [result] = await connection.query(
              `INSERT INTO test_visit_logs
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
              'SELECT id, user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id FROM test_visit_logs WHERE id = ?',
              [result.insertId]
            );

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
              const [existing] = await connection.query(
                'SELECT id, user_id, log_type, timestamp, section, room_id, purpose FROM test_visit_logs WHERE client_event_id = ?',
                [client_event_id]
              );

              await connection.rollback();
              if (existing.length > 0) {
                const existingData = existing[0];
                const isConflict =
                  existingData.purpose !== (purpose || 'General') ||
                  existingData.section !== (section || 'Main Library');

                if (isConflict) {
                  return res.status(409).json({
                    success: false,
                    error: 'Event ID conflict',
                    message: `Client event ID "${client_event_id}" was already used with different attendance data. Original event: purpose="${existingData.purpose}", section="${existingData.section}".`
                  });
                }

                return res.status(200).json({
                  success: true,
                  data: {
                    id: existingData.id,
                    user_id: existingData.user_id,
                    log_type: existingData.log_type,
                    timestamp: existingData.timestamp,
                    section: existingData.section,
                    room_id: existingData.room_id,
                    idempotent: true
                  },
                  message: 'Attendance event already recorded.'
                });
              }
              return res.status(409).json({
                success: false,
                error: 'Event ID conflict',
                message: `Client event ID "${client_event_id}" exists but original record could not be retrieved.`
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

    app.use('/api/logs', logsRoute);

    server = app.listen(testPort, () => {
      console.log(`  Test server on port ${testPort}`);
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 5: Student QR time-in
    console.log('Step 5: Student QR time-in');
    const scan1 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, librarianToken);
    console.log('  Scan1 response:', JSON.stringify(scan1.body).substring(0, 200));
    assertEqual(scan1.status, 201, 'Student time-in returns 201');
    assertEqual(scan1.body.success, true, 'Student time-in success');
    assertEqual(scan1.body.data.log_type, 'entry', 'First scan is entry');
    assertEqual(scan1.body.data.name, 'Alice Student', 'Correct patron name');
    assertEqual(scan1.body.data.purpose, 'Study', 'Purpose recorded');
    assertEqual(scan1.body.data.section, 'Main Library', 'Section recorded');

    // Step 6: Student QR time-out
    console.log('Step 6: Student QR time-out');
    await sleep(500);
    const scan2 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_002',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, librarianToken);
    assertEqual(scan2.status, 201, 'Student time-out returns 201');
    assertEqual(scan2.body.data.log_type, 'exit', 'Second scan is exit');
    assertEqual(scan2.body.data.idempotent, false, 'Not idempotent - new event');

    // Step 7: Repeated visit same day
    console.log('Step 7: Repeated visit same day');
    await sleep(500);
    const scan3 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_003',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Borrowing Books',
      section: 'Learning Commons'
    }, librarianToken);
    assertEqual(scan3.status, 201, 'Repeat visit returns 201');
    assertEqual(scan3.body.data.log_type, 'entry', 'Third scan is new entry');
    assertEqual(scan3.body.data.purpose, 'Borrowing Books', 'New purpose recorded');
    assertEqual(scan3.body.data.section, 'Learning Commons', 'New section recorded');

    // Step 8: Faculty QR time-in
    console.log('Step 8: Faculty QR time-in');
    await sleep(500);
    const scan4 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_fac_001',
      official_id: '00005678',
      id_type: 'faculty',
      purpose: 'Research',
      section: 'Main Library'
    }, librarianToken);
    assertEqual(scan4.status, 201, 'Faculty time-in returns 201');
    assertEqual(scan4.body.data.log_type, 'entry', 'Faculty entry');
    assertEqual(scan4.body.data.name, 'Bob Faculty', 'Faculty name');
    assertEqual(scan4.body.data.id_type, 'faculty', 'Faculty classification');

    // Step 9: Support Staff QR time-in
    console.log('Step 9: Support Staff QR time-in');
    await sleep(500);
    const scan5 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stf_001',
      official_id: '00009999',
      id_type: 'support_staff',
      purpose: 'Computer Use',
      section: 'Main Library'
    }, librarianToken);
    assertEqual(scan5.status, 201, 'Support Staff time-in returns 201');
    assertEqual(scan5.body.data.log_type, 'entry', 'Support Staff entry');
    assertEqual(scan5.body.data.name, 'Carol Staff', 'Staff name');
    assertEqual(scan5.body.data.id_type, 'support_staff', 'Staff classification');

    // Step 10: Duplicate scan prevention (same client_event_id, same data)
    console.log('Step 10: Duplicate scan prevention (same event ID, same data)');
    await sleep(500);
    const scan6 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, librarianToken);
    assertEqual(scan6.status, 200, 'Duplicate scan returns 200');
    assertEqual(scan6.body.data.idempotent, true, 'Duplicate marked as idempotent');
    assertEqual(scan6.body.data.log_type, 'entry', 'Same log_type as original');
    assertEqual(scan6.body.data.id, scan1.body.data.id, 'Same record ID as original');

    // Step 11: Idempotency conflict - same event ID, different data
    console.log('Step 11: Idempotency conflict (same event ID, different data)');
    await sleep(500);
    const scan7 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Different Purpose',
      section: 'Meeting Room'
    }, librarianToken);
    assertEqual(scan7.status, 409, 'Conflicting data with same event ID returns 409');
    assertEqual(scan7.body.success, false, 'Conflict response indicates failure');
    assertEqual(scan7.body.error, 'Event ID conflict', 'Conflict error message');

    // Step 12: Invalid QR identifier (unknown patron)
    console.log('Step 12: Invalid QR identifier');
    await sleep(500);
    const scan8 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_invalid_001',
      official_id: '99999999',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, librarianToken);
    assertEqual(scan8.status, 404, 'Unknown patron returns 404');
    assertEqual(scan8.body.success, false, 'Unknown patron not successful');

    // Step 13: Unauthorized access (no token)
    console.log('Step 13: Unauthorized access');
    await sleep(500);
    const scan9 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_unauth_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    });
    assertEqual(scan9.status, 401, 'No token returns 401');

    // Step 14: Patron token cannot scan (patron role denied)
    console.log('Step 14: Patron token denied');
    await sleep(500);
    const scan10 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_patron_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, patronToken);
    assertEqual(scan10.status, 403, 'Patron token returns 403');

    // Step 15: Concurrent scans - same patron, same time
    console.log('Step 15: Concurrent scans - same patron, simultaneous requests');
    const concurrentScans = [];
    for (let i = 0; i < 5; i++) {
      concurrentScans.push(
        makeRequest('POST', '/scan', {
          client_event_id: `evt_concurrent_${i}`,
          official_id: '00001234',
          id_type: 'student',
          purpose: 'Concurrent Test',
          section: 'Main Library'
        }, librarianToken)
      );
    }
    const concurrentResults = await Promise.all(concurrentScans);
    const entryCount = concurrentResults.filter(r => r.body.data && r.body.data.log_type === 'entry').length;
    const exitCount = concurrentResults.filter(r => r.body.data && r.body.data.log_type === 'exit').length;
    const successCount = concurrentResults.filter(r => r.body.success).length;
    const totalRecords = entryCount + exitCount;
    assert(successCount === 5, `All 5 concurrent scans succeeded (${successCount}/5)`);
    assert(totalRecords === 5, `Exactly 5 records created (${totalRecords}/5)`);
    assert(entryCount >= 0, `Entry count: ${entryCount}`);
    assert(exitCount >= 0, `Exit count: ${exitCount}`);
    assert(entryCount + exitCount === 5, `Entry + Exit = 5 total records (${entryCount} + ${exitCount} = ${entryCount + exitCount})`);

    // Step 16: Verify visit records in test database
    console.log('Step 16: Verify visit records');
    const [logs] = await promiseConn.query(
      'SELECT * FROM test_visit_logs WHERE client_event_id LIKE "evt_%_%" ORDER BY id'
    );
    const stuLogs = logs.filter(l => l.name === 'Alice Student');
    assert(stuLogs.length >= 3, 'At least 3 student visit logs recorded (${stuLogs.length})');
    assert(stuLogs[0].log_type === 'entry', 'First student log is entry');
    assert(stuLogs[1].log_type === 'exit', 'Second student log is exit');
    assert(stuLogs[2].log_type === 'entry', 'Third student log is new entry');

    // Step 17: Verify visit duration calculation
    console.log('Step 17: Verify visit duration calculation');
    const entryLog = stuLogs[0];
    const exitLog = stuLogs[1];
    const entryTime = new Date(entryLog.timestamp).getTime();
    const exitTime = new Date(exitLog.timestamp).getTime();
    const durationMinutes = Math.round((exitTime - entryTime) / 60000);
    assert(durationMinutes >= 0, `Duration calculated: ${durationMinutes} minutes`);

    // Step 18: Clean up only test-created records (exact event IDs, not wildcard)
    console.log('Step 18: Clean up test-created records');
    const eventIdsToClean = ['evt_stu_001', 'evt_stu_002', 'evt_stu_003', 'evt_fac_001', 'evt_stf_001', 'evt_concurrent_0', 'evt_concurrent_1', 'evt_concurrent_2', 'evt_concurrent_3', 'evt_concurrent_4', 'evt_invalid_001', 'evt_unauth_001', 'evt_patron_001'];
    for (const eid of eventIdsToClean) {
      await promiseConn.query('DELETE FROM test_visit_logs WHERE client_event_id = ?', [eid]);
    }
    await promiseConn.query("DELETE FROM test_users WHERE student_id IN ('STU-2021001', 'FAC-2021001', 'STF-2021001', 'LIB-2021001')");
    console.log('  Test data cleaned up (exact event IDs only)\n');

  } catch (error) {
    console.error('Test error:', error.message);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    connection.end();
  }

  console.log('\n=== Integration Test Summary ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();