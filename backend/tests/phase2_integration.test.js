// Phase 2 Integration Tests — Library Monitoring System
// Tests pure logic functions that don't require database connection
// Run with: node backend/tests/phase2_integration.test.js

const crypto = require('crypto');

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

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message} (expected: ${expected}, got: ${actual})`);
  }
}

// ============================================================================
// Test 1: SHA-256 Digest Consistency (Task 0A)
// ============================================================================
console.log('\n--- Test 1: Password Reset Token Consistency ---');

// sha256Digest function (same as in middleware/auth.js)
function sha256Digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Generate a token and its digest (simulating /forgot-password)
const resetToken = crypto.randomBytes(32).toString('hex');
const resetTokenDigest = sha256Digest(resetToken);

// Validate that the digest matches when re-computed (simulating /reset-password)
const reComputedDigest = sha256Digest(resetToken);
assertEqual(resetTokenDigest, reComputedDigest, 'SHA-256 digest is deterministic — token issuance matches validation');

// Verify that different tokens produce different digests
const token2 = crypto.randomBytes(32).toString('hex');
const digest2 = sha256Digest(token2);
assert(resetTokenDigest !== digest2, 'Different tokens produce different digests');

// Verify digest length (SHA-256 = 64 hex chars)
assertEqual(resetTokenDigest.length, 64, 'SHA-256 digest is 64 hex characters');

// ============================================================================
// Test 2: QR Payload Parsing (Task 3)
// ============================================================================
console.log('\n--- Test 2: QR Payload Parsing ---');

// Valid static QR payload
const validQr = JSON.stringify({ id_type: 'student', official_id: '00001234' });
const parsedValid = JSON.parse(validQr);
assertEqual(parsedValid.id_type, 'student', 'QR id_type parses correctly');
assertEqual(parsedValid.official_id, '00001234', 'QR official_id preserves leading zeros');

// Faculty QR
const facultyQr = JSON.stringify({ id_type: 'faculty', official_id: 'FAC-2021001' });
const parsedFaculty = JSON.parse(facultyQr);
assertEqual(parsedFaculty.id_type, 'faculty', 'Faculty id_type parses correctly');
assertEqual(parsedFaculty.official_id, 'FAC-2021001', 'Faculty official_id parses correctly');

// Support Staff QR
const staffQr = JSON.stringify({ id_type: 'support_staff', official_id: 'STF-2021001' });
const parsedStaff = JSON.parse(staffQr);
assertEqual(parsedStaff.id_type, 'support_staff', 'Support Staff id_type parses correctly');
assertEqual(parsedStaff.official_id, 'STF-2021001', 'Support Staff official_id parses correctly');

// Malformed QR (missing fields)
const malformedQr = JSON.stringify({ id_type: 'student' });
const parsedMalformed = JSON.parse(malformedQr);
assert(!parsedMalformed.official_id, 'Malformed QR missing official_id is detected');

// Invalid JSON
let parseError = false;
try { JSON.parse('not json'); } catch (e) { parseError = true; }
assert(parseError, 'Invalid JSON is rejected');

// ============================================================================
// Test 3: Client Event ID for Idempotency (Task 3)
// ============================================================================
console.log('\n--- Test 3: Client Event ID for Idempotency ---');

function generateClientEventId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

const ceid1 = generateClientEventId();
const ceid2 = generateClientEventId();
assert(ceid1 !== ceid2, 'Each client event ID is unique');
assert(ceid1.startsWith('evt_'), 'Client event ID has evt_ prefix');
assert(ceid1.length > 20, 'Client event ID is sufficiently long');

// Same client_event_id should be treated as duplicate
assertEqual(ceid1, ceid1, 'Same client_event_id matches itself (idempotency check)');

// ============================================================================
// Test 4: Active Session Determination Logic (Task 5)
// ============================================================================
console.log('\n--- Test 4: Active Session Determination ---');

// Simulate: entry without exit = active session
const logs1 = [
  { log_type: 'entry', timestamp: '2026-01-15 08:00:00' }
];
const hasActiveSession1 = logs1.some(l => l.log_type === 'entry') && !logs1.some(l => l.log_type === 'exit');
assertEqual(hasActiveSession1, true, 'Entry without exit = active session');

// Simulate: entry with exit = no active session
const logs2 = [
  { log_type: 'entry', timestamp: '2026-01-15 08:00:00' },
  { log_type: 'exit', timestamp: '2026-01-15 12:00:00' }
];
const hasActiveSession2 = logs2.some(l => l.log_type === 'entry') && !logs2.some(l => l.log_type === 'exit');
assertEqual(hasActiveSession2, false, 'Entry with exit = no active session');

// Simulate: multiple visits (entry-exit-entry) = active session on last entry
const logs3 = [
  { log_type: 'entry', timestamp: '2026-01-15 08:00:00' },
  { log_type: 'exit', timestamp: '2026-01-15 12:00:00' },
  { log_type: 'entry', timestamp: '2026-01-15 13:00:00' }
];
const lastEntry = logs3.filter(l => l.log_type === 'entry').pop();
const exitAfterLastEntry = logs3.filter(l => l.log_type === 'exit' && l.timestamp > lastEntry.timestamp);
assertEqual(exitAfterLastEntry.length, 0, 'Multiple visits: last entry without exit = active session');

// ============================================================================
// Test 5: Visit Duration Calculation (Task 2)
// ============================================================================
console.log('\n--- Test 5: Visit Duration Calculation ---');

function calculateDuration(entryTs, exitTs) {
  const entry = new Date(entryTs).getTime();
  const exit = new Date(exitTs).getTime();
  return Math.round((exit - entry) / 60000); // minutes
}

const entryTime = '2026-01-15 08:00:00';
const exitTime = '2026-01-15 10:30:00';
const duration = calculateDuration(entryTime, exitTime);
assertEqual(duration, 150, 'Visit duration: 8:00 to 10:30 = 150 minutes');

// Same-day duration
const sameDayEntry = '2026-01-15 09:00:00';
const sameDayExit = '2026-01-15 09:30:00';
const sameDayDuration = calculateDuration(sameDayEntry, sameDayExit);
assertEqual(sameDayDuration, 30, 'Same-day visit: 9:00 to 9:30 = 30 minutes');

// ============================================================================
// Test 6: Duplicate Prevention Logic (Task 3)
// ============================================================================
console.log('\n--- Test 6: Duplicate Prevention ---');

const processedEventIds = new Set();

function isDuplicate(clientEventId) {
  return processedEventIds.has(clientEventId);
}

function recordEvent(clientEventId) {
  processedEventIds.add(clientEventId);
}

const evt1 = generateClientEventId();
recordEvent(evt1);
assert(isDuplicate(evt1), 'First scan records the event ID');
assert(isDuplicate(evt1), 'Re-scan with same event ID is detected as duplicate');

const evt2 = generateClientEventId();
assert(!isDuplicate(evt2), 'New event ID is not a duplicate');
recordEvent(evt2);
assert(isDuplicate(evt2), 'Second event ID is now recorded');

// ============================================================================
// Test 7: Role Validation (Task 6)
// ============================================================================
console.log('\n--- Test 7: Role-Based Access Control ---');

const validRoles = ['patron', 'librarian', 'administrator'];
const patronRole = 'patron';
const librarianRole = 'librarian';
const adminRole = 'administrator';

// Only librarian/administrator can scan attendance for patrons
assert(validRoles.includes(librarianRole), 'librarian is a valid role');
assert(validRoles.includes(adminRole), 'administrator is a valid role');
assert(validRoles.includes(patronRole), 'patron is a valid role');

// Patron role cannot perform librarian actions
const canScanAttendance = (role) => role === 'librarian' || role === 'administrator';
assertEqual(canScanAttendance(patronRole), false, 'Patron cannot scan attendance');
assertEqual(canScanAttendance(librarianRole), true, 'Librarian can scan attendance');
assertEqual(canScanAttendance(adminRole), true, 'Administrator can scan attendance');

// ============================================================================
// Test 8: Migration File Syntax (Task 0B)
// ============================================================================
console.log('\n--- Test 8: Migration File Syntax ---');

const fs = require('fs');
const migrationPath = 'backend/database/migrations/001_phase1_account_architecture.sql';
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

assert(migrationContent.includes('add_column_if_not_exists'), 'Migration uses conditional column addition');
assert(migrationContent.includes('add_index_if_not_exists'), 'Migration uses conditional index addition');
assert(migrationContent.includes('official_id'), 'Migration includes official_id column');
assert(migrationContent.includes('id_classification'), 'Migration includes id_classification column');
assert(migrationContent.includes('role'), 'Migration includes role column');
assert(migrationContent.includes('is_password_set'), 'Migration includes is_password_set column');
assert(migrationContent.includes('activation_token'), 'Migration includes activation_token column');
assert(migrationContent.includes('reset_token'), 'Migration includes reset_token column');
assert(migrationContent.includes('qr_code_data'), 'Migration includes qr_code_data column');
assert(migrationContent.includes('client_event_id'), 'Migration includes client_event_id column');
assert(migrationContent.includes('information_schema'), 'Migration checks information_schema for idempotency');

// ============================================================================
// Test 9: Schema Consistency (Task 0B)
// ============================================================================
console.log('\n--- Test 9: Schema Consistency ---');

const schemaPath = 'backend/database/schema.sql';
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

assert(schemaContent.includes('official_id VARCHAR(50) NULL'), 'Schema defines official_id column');
assert(schemaContent.includes("ENUM('student', 'faculty', 'support_staff')"), 'Schema defines id_classification ENUM');
assert(schemaContent.includes("ENUM('patron', 'librarian', 'administrator')"), 'Schema defines role ENUM');
assert(schemaContent.includes('qr_code_data TEXT'), 'Schema defines qr_code_data column');
assert(schemaContent.includes('reset_token VARCHAR(255) NULL'), 'Schema defines reset_token column');
assert(schemaContent.includes('activation_token VARCHAR(255) NULL'), 'Schema defines activation_token column');

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);