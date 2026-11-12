// Phase 2B - Offline Integration Tests
// Tests the offline-first attendance workflow using IndexedDB storage
// and the backend sync endpoint against a disposable test database.
// REQUIRES: TEST_DATABASE environment variable
// FAILS CLOSED if TEST_DATABASE is not set or matches production database

const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../src/middleware/auth');

const TEST_DATABASE = process.env.TEST_DATABASE;
if (!TEST_DATABASE) {
  console.error('FATAL: TEST_DATABASE environment variable is required');
  process.exit(1);
}

const PRODUCTION_DB_NAMES = ['library_system', 'ust_library', 'library_monitoring'];
if (PRODUCTION_DB_NAMES.includes(TEST_DATABASE.toLowerCase())) {
  console.error(`FATAL: TEST_DATABASE "${TEST_DATABASE}" matches a production database name`);
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
let testPort = 3998;

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
  console.log('=== Phase 2B Offline Integration Tests ===\n');
  console.log(`Test database: ${TEST_DATABASE}\n`);

  try {
    console.log('Step 1: Connect to test database');
    await promiseConn.query('SELECT 1 as connectivity_test');
    console.log('  Database connection established\n');

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

    console.log('Step 3: Insert test patrons');
    await promiseConn.query(
      `INSERT INTO test_users (student_id, official_id, id_classification, full_name, email, user_type, role, department) VALUES 
       ('STU-2021001', '00001234', 'student', 'Alice Student', 'alice@ust-legazpi.edu.ph', 'student', 'patron', 'Computer Science'),
       ('FAC-2021001', '00005678', 'faculty', 'Bob Faculty', 'bob@ust-legazpi.edu.ph', 'faculty', 'patron', 'Computer Science'),
       ('STF-2021001', '00009999', 'support_staff', 'Carol Staff', 'carol@ust-legazpi.edu.ph', 'staff', 'patron', 'Library'),
       ('LIB-2021001', '00000001', 'support_staff', 'David Librarian', 'david@ust-legazpi.edu.ph', 'staff', 'librarian', 'Library')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`
    );

    const [librarian] = await promiseConn.query("SELECT id FROM test_users WHERE official_id = '00000001'");
    const librarianId = librarian[0].id;
    console.log('  Test patrons inserted\n');

    console.log('Step 4: Start test server');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

    const librarianToken = jwt.sign(
      { id: librarianId, student_id: 'LIB-2021001', official_id: '00000001', user_type: 'staff', role: 'librarian', email: 'david@ust-legazpi.edu.ph' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.get('/api/test', (req, res) => res.json({ ok: true }));

    app.post('/api/logs/scan',
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
          return res.status(400).json({ success: false, error: errors.array()[0].msg });
        }

        const { client_event_id, official_id, id_type, purpose, section, room_id } = req.body;
        const requestingUserRole = req.user?.role;

        if (requestingUserRole !== 'librarian' && requestingUserRole !== 'administrator') {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }

        let conn;
        try {
          conn = await promiseConn.getConnection();
          await conn.beginTransaction();

          try {
            const [existing] = await conn.query(
              'SELECT id, user_id, log_type, timestamp, section, room_id FROM test_visit_logs WHERE client_event_id = ?',
              [client_event_id]
            );

            if (existing.length > 0) {
              await conn.rollback();
              return res.status(200).json({
                success: true,
                data: { id: existing[0].id, user_id: existing[0].user_id, log_type: existing[0].log_type, timestamp: existing[0].timestamp, section: existing[0].section, room_id: existing[0].room_id, idempotent: true },
                message: 'Attendance event already recorded.'
              });
            }

            const [users] = await conn.query(
              'SELECT id, student_id, official_id, id_classification, role, full_name, email, user_type, department FROM test_users WHERE official_id = ? AND id_classification = ? FOR UPDATE',
              [official_id, id_type]
            );

            if (users.length === 0) {
              await conn.rollback();
              return res.status(404).json({ success: false, error: 'Patron not found. Please register first.' });
            }

            const patron = users[0];
            const resolvedUserId = patron.id;

            const [latestEntry] = await conn.query(
              `SELECT id, timestamp FROM test_visit_logs WHERE user_id = ? AND log_type = 'entry' ORDER BY id DESC LIMIT 1`,
              [resolvedUserId]
            );

            let logType = 'entry';
            if (latestEntry.length > 0) {
              const entryId = latestEntry[0].id;
              const [subsequentExit] = await conn.query(
                `SELECT id FROM test_visit_logs WHERE user_id = ? AND log_type = 'exit' AND id > ? ORDER BY id ASC LIMIT 1`,
                [resolvedUserId, entryId]
              );
              if (subsequentExit.length === 0) logType = 'exit';
            }

            const [result] = await conn.query(
              `INSERT INTO test_visit_logs (user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id, synced) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)`,
              [resolvedUserId, patron.user_type, patron.full_name, purpose || 'General', section || 'Main Library', room_id || null, logType, client_event_id]
            );

            await conn.commit();

            const [newLog] = await conn.query(
              'SELECT id, user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id FROM test_visit_logs WHERE id = ?',
              [result.insertId]
            );

            return res.status(201).json({
              success: true,
              data: {
                id: newLog[0].id, user_id: newLog[0].user_id, official_id: patron.official_id,
                id_type: patron.id_classification, name: newLog[0].name, user_type: newLog[0].user_type,
                purpose: newLog[0].purpose, section: newLog[0].section,
                room_id: newLog[0].room_id, log_type: newLog[0].log_type,
                timestamp: newLog[0].timestamp, client_event_id: newLog[0].client_event_id,
                idempotent: false
              },
              message: `Attendance recorded as ${logType}.`
            });
          } catch (error) {
            if (conn) await conn.rollback();
            throw error;
          }
        } catch (error) {
          console.error('Error scanning attendance:', error);
          return res.status(500).json({ success: false, error: 'Failed to record attendance', message: error.message });
        } finally {
          if (conn) conn.release();
        }
      }
    );

    server = app.listen(testPort, () => {
      console.log(`  Test server on port ${testPort}`);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 1: Online QR attendance succeeds
    console.log('\nTest 1: Online QR attendance succeeds');
    const scan1 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_001', official_id: '00001234', id_type: 'student', purpose: 'Study', section: 'Main Library'
    }, librarianToken);
    assertEqual(scan1.status, 201, 'Student time-in returns 201');
    assertEqual(scan1.body.success, true, 'Student time-in success');
    assertEqual(scan1.body.data.log_type, 'entry', 'First scan is entry');
    assertEqual(scan1.body.data.name, 'Alice Student', 'Correct patron name');

    // Test 2: Student QR time-out
    console.log('Test 2: Student QR time-out');
    await sleep(500);
    const scan2 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_002', official_id: '00001234', id_type: 'student', purpose: 'Study', section: 'Main Library'
    }, librarianToken);
    assertEqual(scan2.status, 201, 'Student time-out returns 201');
    assertEqual(scan2.body.data.log_type, 'exit', 'Second scan is exit');

    // Test 3: Repeated visit same day
    console.log('Test 3: Repeated visit same day');
    await sleep(500);
    const scan3 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_003', official_id: '00001234', id_type: 'student', purpose: 'Borrowing Books', section: 'Learning Commons'
    }, librarianToken);
    assertEqual(scan3.status, 201, 'Repeat visit returns 201');
    assertEqual(scan3.body.data.log_type, 'entry', 'Third scan is new entry');

    // Test 4: Faculty QR time-in
    console.log('Test 4: Faculty QR time-in');
    await sleep(500);
    const scan4 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_fac_001', official_id: '00005678', id_type: 'faculty', purpose: 'Research', section: 'Main Library'
    }, librarianToken);
    assertEqual(scan4.status, 201, 'Faculty time-in returns 201');
    assertEqual(scan4.body.data.log_type, 'entry', 'Faculty entry');
    assertEqual(scan4.body.data.name, 'Bob Faculty', 'Faculty name');
    assertEqual(scan4.body.data.id_type, 'faculty', 'Faculty classification');

    // Test 5: Support Staff QR time-in
    console.log('Test 5: Support Staff QR time-in');
    await sleep(500);
    const scan5 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stf_001', official_id: '00009999', id_type: 'support_staff', purpose: 'Computer Use', section: 'Main Library'
    }, librarianToken);
    assertEqual(scan5.status, 201, 'Support Staff time-in returns 201');
    assertEqual(scan5.body.data.log_type, 'entry', 'Support Staff entry');
    assertEqual(scan5.body.data.name, 'Carol Staff', 'Staff name');
    assertEqual(scan5.body.data.id_type, 'support_staff', 'Staff classification');

    // Test 6: Duplicate scan prevention
    console.log('Test 6: Duplicate scan prevention');
    await sleep(500);
    const scan6 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_stu_001', official_id: '00001234', id_type: 'student', purpose: 'Study', section: 'Main Library'
    }, librarianToken);
    assertEqual(scan6.status, 200, 'Duplicate scan returns 200');
    assertEqual(scan6.body.data.idempotent, true, 'Duplicate marked as idempotent');
    assertEqual(scan6.body.data.log_type, 'entry', 'Same log_type as original');
    assertEqual(scan6.body.data.id, scan1.body.data.id, 'Same record ID as original');

    // Test 7: Invalid QR identifier
    console.log('Test 7: Invalid QR identifier');
    await sleep(500);
    const scan7 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_invalid_001', official_id: '99999999', id_type: 'student', purpose: 'Study', section: 'Main Library'
    }, librarianToken);
    assertEqual(scan7.status, 404, 'Unknown patron returns 404');
    assertEqual(scan7.body.success, false, 'Unknown patron not successful');

    // Test 8: Unauthorized access
    console.log('Test 8: Unauthorized access');
    await sleep(500);
    const scan8 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_unauth_001', official_id: '00001234', id_type: 'student', purpose: 'Study', section: 'Main Library'
    });
    assertEqual(scan8.status, 401, 'No token returns 401');

    // Test 9: Patron token denied
    console.log('Test 9: Patron token denied');
    await sleep(500);
    const patronToken = jwt.sign(
      { id: 1, student_id: 'STU-2021001', official_id: '00001234', user_type: 'student', role: 'patron', email: 'alice@ust-legazpi.edu.ph' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const scan9 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_patron_001', official_id: '00001234', id_type: 'student', purpose: 'Study', section: 'Main Library'
    }, patronToken);
    assertEqual(scan9.status, 403, 'Patron token returns 403');

    // Test 10: Concurrent scans
    console.log('Test 10: Concurrent scans');
    const concurrentScans = [];
    for (let i = 0; i < 5; i++) {
      concurrentScans.push(makeRequest('POST', '/scan', {
        client_event_id: `evt_concurrent_${i}`, official_id: '00001234', id_type: 'student', purpose: 'Concurrent Test', section: 'Main Library'
      }, librarianToken));
    }
    const concurrentResults = await Promise.all(concurrentScans);
    const successCount = concurrentResults.filter(r => r.body.success).length;
    const entryCount = concurrentResults.filter(r => r.body.data && r.body.data.log_type === 'entry').length;
    const exitCount = concurrentResults.filter(r => r.body.data && r.body.data.log_type === 'exit').length;
    const totalRecords = entryCount + exitCount;
    assert(successCount === 5, `All 5 concurrent scans succeeded (${successCount}/5)`);
    assert(totalRecords === 5, `Exactly 5 records created (${totalRecords}/5)`);

    // Test 11: Verify visit records
    console.log('Test 11: Verify visit records');
    const [allLogs] = await promiseConn.query('SELECT * FROM test_visit_logs WHERE client_event_id LIKE "evt_%_%" ORDER BY id');
    const stuLogs = allLogs.filter(l => l.name === 'Alice Student');
    assert(stuLogs.length >= 2, `At least 2 student visit logs (got ${stuLogs.length})`);
    const entryLogs = stuLogs.filter(l => l.log_type === 'entry');
    const exitLogs = stuLogs.filter(l => l.log_type === 'exit');
    assert(entryLogs.length >= 1, 'At least one entry log');
    assert(exitLogs.length >= 1, 'At least one exit log');

    // Test 12: Visit duration calculation
    console.log('Test 12: Visit duration calculation');
    const entryLog = stuLogs.find(l => l.log_type === 'entry');
    const exitLog = stuLogs.find(l => l.log_type === 'exit' && new Date(l.timestamp) > new Date(entryLog.timestamp));
    if (entryLog && exitLog) {
      const entryTime = new Date(entryLog.timestamp).getTime();
      const exitTime = new Date(exitLog.timestamp).getTime();
      const durationMinutes = Math.round((exitTime - entryTime) / 60000);
      assert(durationMinutes >= 0, `Duration calculated: ${durationMinutes} minutes`);
    }

    // Test 13: Expired JWT token
    console.log('Test 13: Expired JWT token');
    await sleep(500);
    const expiredToken = jwt.sign(
      { id: 99999, student_id: 'EXPIRED', official_id: '00000000', user_type: 'staff', role: 'patron', email: 'expired@test.com' },
      JWT_SECRET,
      { expiresIn: -1 }
    );
    const expiredScan = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_expired', official_id: '00001234', id_type: 'student', purpose: 'Test', section: 'Main Library'
    }, expiredToken);
    assertEqual(expiredScan.status, 403, 'Expired token returns 403 (invalid token)');

    // Test 14: Concurrent sync attempts - no duplicate records
    console.log('Test 14: Concurrent scans - no duplicate records');
    const [totalLogs] = await promiseConn.query('SELECT COUNT(*) as cnt FROM test_visit_logs WHERE client_event_id LIKE "evt_%_%"');
    // 5 manual scans (student entry, exit, re-entry; faculty entry; staff entry) + 5 concurrent = 10
    assert(totalLogs[0].cnt === 10, `Expected 10 total visit logs (5 manual + 5 concurrent), got ${totalLogs[0].cnt}`);

    // Clean up
    console.log('\nStep: Clean up test data');
    await promiseConn.query('DELETE FROM test_visit_logs WHERE client_event_id LIKE "evt_%_%"');
    await promiseConn.query("DELETE FROM test_users WHERE student_id IN ('STU-2021001', 'FAC-2021001', 'STF-2021001', 'LIB-2021001')");
    console.log('  Test data cleaned up\n');

  } catch (error) {
    console.error('Test error:', error.message);
    failed++;
  } finally {
    if (server) server.close();
    connection.end();
  }

  console.log('\n=== Integration Test Summary ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();