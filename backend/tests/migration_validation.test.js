// Migration Validation Test
// Tests Phase 1 migration against disposable test tables in library_system_local
// Does NOT modify live users/visit_logs tables

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

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

async function main() {
  console.log('=== Migration Validation Test ===\n');

  try {
    // Step 1: Create disposable test tables
    console.log('Step 1: Create disposable test tables');
    await promiseConn.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50) NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        user_type ENUM('student', 'faculty', 'staff', 'guest', 'visitor') DEFAULT 'student',
        department VARCHAR(255),
        course VARCHAR(255),
        year_level VARCHAR(50),
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id),
        INDEX idx_user_type (user_type)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_log_type (log_type),
        INDEX idx_section (section),
        INDEX idx_room_id (room_id)
      )
    `);
    console.log('  Test tables created\n');

    // Step 2: Insert test patron records
    console.log('Step 2: Insert test patron records');
    await promiseConn.query(
      `INSERT INTO test_users (student_id, full_name, email, user_type, department) VALUES 
       ('STU-2021001', 'Alice Student', 'alice@ust-legazpi.edu.ph', 'student', 'Computer Science'),
       ('FAC-2021001', 'Bob Faculty', 'bob@ust-legazpi.edu.ph', 'faculty', 'Computer Science'),
       ('STF-2021001', 'Carol Staff', 'carol@ust-legazpi.edu.ph', 'staff', 'Library')`
    );
    console.log('  Test patrons inserted\n');

    // Step 3: Run migration (add columns idempotently)
    console.log('Step 3: Run migration - add columns');
    const migrationStatements = [
      `ALTER TABLE test_users ADD COLUMN official_id VARCHAR(50) NULL`,
      `ALTER TABLE test_users ADD COLUMN id_classification ENUM('student', 'faculty', 'support_staff') NULL`,
      `ALTER TABLE test_users ADD COLUMN role ENUM('patron', 'librarian', 'administrator') DEFAULT 'patron'`,
      `ALTER TABLE test_users ADD COLUMN is_password_set TINYINT(1) DEFAULT 0`,
      `ALTER TABLE test_users ADD COLUMN activation_token VARCHAR(255) NULL`,
      `ALTER TABLE test_users ADD COLUMN activation_expires DATETIME NULL`,
      `ALTER TABLE test_users ADD COLUMN reset_token VARCHAR(255) NULL`,
      `ALTER TABLE test_users ADD COLUMN reset_expires DATETIME NULL`,
      `ALTER TABLE test_users ADD COLUMN qr_code_data TEXT`,
      `ALTER TABLE test_visit_logs ADD COLUMN client_event_id VARCHAR(64) NULL`
    ];

    for (const stmt of migrationStatements) {
      try {
        await promiseConn.query(stmt);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          // Column already exists - skip (idempotent)
          continue;
        }
        throw e;
      }
    }
    console.log('  Columns added\n');

    // Step 4: Add indexes idempotently
    console.log('Step 4: Add indexes idempotently');
    const indexStatements = [
      `CREATE INDEX idx_official_id ON test_users (official_id)`,
      `CREATE INDEX idx_id_classification ON test_users (id_classification)`,
      `CREATE INDEX idx_role ON test_users (role)`,
      `CREATE INDEX idx_activation_token ON test_users (activation_token)`,
      `CREATE INDEX idx_reset_token ON test_users (reset_token)`,
      `CREATE UNIQUE INDEX uk_client_event_id ON test_visit_logs (client_event_id)`
    ];

    for (const stmt of indexStatements) {
      try {
        await promiseConn.query(stmt);
      } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_DUP_INDEX') {
          continue; // Index already exists
        }
        throw e;
      }
    }
    console.log('  Indexes added\n');

    // Step 5: Run migration again (idempotency test)
    console.log('Step 5: Re-run migration (idempotency test)');
    let idempotentOk = true;
    for (const stmt of migrationStatements) {
      try {
        await promiseConn.query(stmt);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          continue; // Expected - column already exists
        }
        idempotentOk = false;
        console.log(`  Unexpected error: ${e.message}`);
      }
    }
    assert(idempotentOk, 'Migration is idempotent - can run twice without errors');

    // Step 6: Verify columns were added
    console.log('Step 6: Verify columns were added');
    const [columns] = await promiseConn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_users'`
    );
    const columnNames = columns.map(c => c.COLUMN_NAME);
    assert(columnNames.includes('official_id'), 'official_id column exists');
    assert(columnNames.includes('id_classification'), 'id_classification column exists');
    assert(columnNames.includes('role'), 'role column exists');
    assert(columnNames.includes('is_password_set'), 'is_password_set column exists');
    assert(columnNames.includes('activation_token'), 'activation_token column exists');
    assert(columnNames.includes('reset_token'), 'reset_token column exists');
    assert(columnNames.includes('qr_code_data'), 'qr_code_data column exists');

    const [logColumns] = await promiseConn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_visit_logs'`
    );
    const logColumnNames = logColumns.map(c => c.COLUMN_NAME);
    assert(logColumnNames.includes('client_event_id'), 'client_event_id column exists in visit_logs');

    // Step 7: Verify indexes
    console.log('Step 7: Verify indexes were created');
    const [indexes] = await promiseConn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_users'`
    );
    const indexNames = indexes.map(i => i.INDEX_NAME);
    assert(indexNames.includes('idx_official_id'), 'idx_official_id index exists');
    assert(indexNames.includes('idx_role'), 'idx_role index exists');

    const [logIndexes] = await promiseConn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_visit_logs'`
    );
    const logIndexNames = logIndexes.map(i => i.INDEX_NAME);
    assert(logIndexNames.includes('uk_client_event_id'), 'uk_client_event_id unique index exists');

    // Step 8: Test that existing data is preserved
    console.log('Step 8: Verify existing data preserved');
    const [patrons] = await promiseConn.query('SELECT * FROM test_users');
    assert(patrons.length === 3, 'All 3 test patrons preserved after migration');
    assert(patrons[0].role === 'patron', 'Default role set to patron');

    // Step 9: Test client_event_id uniqueness
    console.log('Step 9: Test client_event_id uniqueness');
    await promiseConn.query(
      `INSERT IGNORE INTO test_users (student_id, full_name, email, user_type, department) VALUES 
       ('STU-UNIQUE', 'Unique User', 'unique@test.com', 'student', 'Computer Science')`
    );
    await promiseConn.query(
      `INSERT INTO test_visit_logs (user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id, synced) 
       VALUES (1, 'student', 'Unique User', 'General', 'Main Library', NULL, 'entry', NOW(), 'evt_test_001', 1)`
    );
    try {
      await promiseConn.query(
        `INSERT INTO test_visit_logs (user_id, user_type, name, purpose, section, room_id, log_type, timestamp, client_event_id, synced) 
         VALUES (1, 'student', 'Alice Student', 'General', 'Main Library', NULL, 'entry', NOW(), 'evt_test_001', 1)`
      );
      assert(false, 'Duplicate client_event_id should be rejected');
    } catch (e) {
      assert(e.code === 'ER_DUP_ENTRY', 'Duplicate client_event_id rejected by UNIQUE constraint');
    }

    // Step 10: Clean up test tables
    console.log('Step 10: Clean up test tables');
    await promiseConn.query('DROP TABLE IF EXISTS test_visit_logs');
    await promiseConn.query('DROP TABLE IF EXISTS test_users');
    console.log('  Test tables dropped\n');

  } catch (error) {
    console.error('Test error:', error.message);
    failed++;
  } finally {
    connection.end();
  }

  console.log('\n=== Migration Validation Summary ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();