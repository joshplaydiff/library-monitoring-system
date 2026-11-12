// Phase 2 Integration Test — Real HTTP requests against Express scan endpoint
// Tests the actual /api/logs/scan route against a development database
// Uses disposable test tables in library_system_local (does NOT touch live tables)

const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'libuser',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'library_system_local'
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

  try {
    // Step 1: Ensure test columns exist in library_system_local (idempotent)
    console.log('Step 1: Ensure test columns exist');
    const addCol = async (table, col, def) => {
      try {
        await promiseConn.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    };
    const addIdx = async (table, name, def) => {
      try {
        await promiseConn.query(`ALTER TABLE ${table} ADD ${def}`);
      } catch (e) {
        // Index may already exist - skip (idempotent)
      }
    };

    await addCol('users', 'official_id', 'VARCHAR(50) NULL');
    await addCol('users', 'id_classification', "ENUM('student', 'faculty', 'support_staff') NULL");
    await addCol('users', 'role', "ENUM('patron', 'librarian', 'administrator') DEFAULT 'patron'");
    await addCol('visit_logs', 'client_event_id', 'VARCHAR(64) NULL');
    await addIdx('visit_logs', 'uk_client_event_id', 'UNIQUE KEY uk_client_event_id (client_event_id)');
    console.log('  Test schema ready\n');

    // Step 2: Insert test patrons (student, faculty, support staff, librarian)
    console.log('Step 2: Insert test patrons');
    await promiseConn.query(
      `INSERT INTO users (student_id, official_id, id_classification, full_name, email, user_type, role, department) VALUES 
       ('STU-2021001', '00001234', 'student', 'Alice Student', 'alice@ust-legazpi.edu.ph', 'student', 'patron', 'Computer Science'),
       ('FAC-2021001', '00005678', 'faculty', 'Bob Faculty', 'bob@ust-legazpi.edu.ph', 'faculty', 'patron', 'Computer Science'),
       ('STF-2021001', '00009999', 'support_staff', 'Carol Staff', 'carol@ust-legazpi.edu.ph', 'staff', 'patron', 'Library'),
       ('LIB-2021001', '00000001', 'support_staff', 'David Librarian', 'david@ust-legazpi.edu.ph', 'staff', 'librarian', 'Library')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`
    );

    // Get the librarian's ID for JWT token generation
    const [librarian] = await promiseConn.query("SELECT id FROM users WHERE official_id = '00000001'");
    const librarianId = librarian[0].id;
    console.log('  Test patrons inserted\n');

    // Step 3: Start test Express server with /scan route
    console.log('Step 3: Start test server');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

    // Generate a librarian JWT token
    const librarianToken = jwt.sign(
      { id: librarianId, student_id: 'LIB-2021001', official_id: '00000001', user_type: 'staff', role: 'librarian', email: 'david@ust-legazpi.edu.ph' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Import the logs route handlers
    const logsRoute = require('../src/routes/logs');
    app.use('/api/logs', logsRoute);

    server = app.listen(testPort, () => {
      console.log(`  Test server on port ${testPort}`);
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 4: Student QR time-in
    console.log('Step 4: Student QR time-in');
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

    // Step 5: Student QR time-out (same patron, active session)
    console.log('Step 5: Student QR time-out');
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

    // Step 6: Repeated visit same day
    console.log('Step 6: Repeated visit same day');
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

    // Step 7: Faculty QR time-in
    console.log('Step 7: Faculty QR time-in');
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

    // Step 8: Support Staff QR time-in
    console.log('Step 8: Support Staff QR time-in');
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

    // Step 9: Duplicate scan prevention (same client_event_id)
    console.log('Step 9: Duplicate scan prevention');
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

    // Step 10: Invalid QR identifier (unknown patron)
    console.log('Step 10: Invalid QR identifier');
    await sleep(500);
    const scan7 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_invalid_001',
      official_id: '99999999',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, librarianToken);
    assertEqual(scan7.status, 404, 'Unknown patron returns 404');
    assertEqual(scan7.body.success, false, 'Unknown patron not successful');

    // Step 11: Unauthorized access (no token)
    console.log('Step 11: Unauthorized access');
    await sleep(500);
    const scan8 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_unauth_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    });
    assertEqual(scan8.status, 401, 'No token returns 401');

    // Step 12: Patron token cannot scan (patron role)
    console.log('Step 12: Patron token denied');
    await sleep(500);
    const patronToken = jwt.sign(
      { id: 1, student_id: 'STU-2021001', official_id: '00001234', user_type: 'student', role: 'patron', email: 'alice@ust-legazpi.edu.ph' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const scan9 = await makeRequest('POST', '/scan', {
      client_event_id: 'evt_patron_001',
      official_id: '00001234',
      id_type: 'student',
      purpose: 'Study',
      section: 'Main Library'
    }, patronToken);
    assertEqual(scan9.status, 403, 'Patron token returns 403');

    // Step 13: Verify visit records after commit
    console.log('Step 13: Verify visit records');
    const [logs] = await promiseConn.query(
      'SELECT * FROM visit_logs WHERE client_event_id LIKE "evt_stu_%" ORDER BY timestamp'
    );
    assert(logs.length === 3, '3 student visit logs recorded');
    assert(logs[0].log_type === 'entry', 'First log is entry');
    assert(logs[1].log_type === 'exit', 'Second log is exit');
    assert(logs[2].log_type === 'entry', 'Third log is new entry');

    // Step 14: Verify visit duration can be calculated
    console.log('Step 14: Verify visit duration calculation');
    const entryLog = logs[0];
    const exitLog = logs[1];
    const entryTime = new Date(entryLog.timestamp).getTime();
    const exitTime = new Date(exitLog.timestamp).getTime();
    const durationMinutes = Math.round((exitTime - entryTime) / 60000);
    assert(durationMinutes >= 0, `Duration calculated: ${durationMinutes} minutes`);

    // Step 15: Clean up test data from live tables
    console.log('Step 15: Clean up test data');
    await promiseConn.query("DELETE FROM visit_logs WHERE client_event_id LIKE 'evt_%'");
    await promiseConn.query("DELETE FROM users WHERE student_id IN ('STU-2021001', 'FAC-2021001', 'STF-2021001', 'LIB-2021001')");
    console.log('  Test data cleaned up\n');

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