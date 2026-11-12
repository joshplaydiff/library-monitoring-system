-- Migration: 001_phase1_account_architecture.sql
-- Phase 1: Account Role Architecture and Static QR Identification
-- Applies to: users table
-- Description: Adds official UST ID classification, application role separation,
--   password activation state, token-based activation and password reset with
--   SHA-256 digests, and static QR payload storage.
--
-- NOTE: Do NOT apply to the live university database until recoverability is
-- verified. Take a mysqldump backup first. Test on an isolated development
-- database with fictitious accounts.
--
-- This migration is backward compatible: existing columns are preserved and
-- new columns are nullable with default values where applicable.
-- All ALTER TABLE operations are guarded with information_schema checks so
-- the migration is idempotent and safe to re-run.

DELIMITER //

-- Helper procedure: add a column only if it does not already exist
CREATE PROCEDURE IF NOT EXISTS add_column_if_not_exists(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_column_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_column_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

-- Helper procedure: add an index only if it does not already exist
CREATE PROCEDURE IF NOT EXISTS add_index_if_not_exists(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_index_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD ', p_index_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DELIMITER ;

-- ============================================================================
-- Step 1b: Add client_event_id to visit_logs for idempotent scan deduplication
-- ============================================================================

CALL add_column_if_not_exists('visit_logs', 'client_event_id', 'VARCHAR(64) NULL COMMENT "Client-generated unique event ID for idempotent scan deduplication"');
CALL add_index_if_not_exists('visit_logs', 'uk_client_event_id', 'UNIQUE KEY uk_client_event_id (client_event_id)');

-- ============================================================================
-- Step 1: Add new columns to users table (idempotent)
-- ============================================================================

CALL add_column_if_not_exists('users', 'official_id', 'VARCHAR(50) NULL COMMENT "Official UST-Legazpi ID number (string, preserves leading zeros)"');
CALL add_column_if_not_exists('users', 'id_classification', "ENUM('student', 'faculty', 'support_staff') NULL COMMENT 'University ID classification'");
CALL add_column_if_not_exists('users', 'role', "ENUM('patron', 'librarian', 'administrator') DEFAULT 'patron' COMMENT 'Application access permission'");
CALL add_column_if_not_exists('users', 'is_password_set', 'TINYINT(1) DEFAULT 0 COMMENT "Whether the patron has set their password"');
CALL add_column_if_not_exists('users', 'activation_token', 'VARCHAR(255) NULL COMMENT "SHA-256 digest of activation token"');
CALL add_column_if_not_exists('users', 'activation_expires', 'DATETIME NULL COMMENT "Activation token expiration"');
CALL add_column_if_not_exists('users', 'reset_token', 'VARCHAR(255) NULL COMMENT "SHA-256 digest of password reset token"');
CALL add_column_if_not_exists('users', 'reset_expires', 'DATETIME NULL COMMENT "Password reset token expiration"');
CALL add_column_if_not_exists('users', 'qr_code_data', 'TEXT COMMENT "Stored static QR payload (id_type + official_id)"');

-- ============================================================================
-- Step 2: Add indexes (idempotent)
-- ============================================================================

CALL add_index_if_not_exists('users', 'idx_official_id', 'INDEX idx_official_id (official_id)');
CALL add_index_if_not_exists('users', 'idx_id_classification', 'INDEX idx_id_classification (id_classification)');
CALL add_index_if_not_exists('users', 'idx_role', 'INDEX idx_role (role)');
CALL add_index_if_not_exists('users', 'idx_activation_token', 'INDEX idx_activation_token (activation_token)');
CALL add_index_if_not_exists('users', 'idx_reset_token', 'INDEX idx_reset_token (reset_token)');

-- ============================================================================
-- Step 3: Backfill existing records
-- ============================================================================

-- Set default role for all existing records
UPDATE users SET role = 'patron' WHERE role IS NULL OR role = '';

-- Mark accounts with existing password_hash as password set
UPDATE users SET is_password_set = 1 WHERE password_hash IS NOT NULL AND password_hash != '';
UPDATE users SET is_password_set = 0 WHERE password_hash IS NULL OR password_hash = '';

-- ============================================================================
-- Step 4: Optional composite uniqueness constraint
-- ============================================================================
-- Prevent ID collisions across classifications (e.g., student 2021001 and
-- faculty 2021001). Uncomment after verifying no existing duplicates:
--
-- ALTER TABLE users ADD UNIQUE KEY uk_classification_official_id (id_classification, official_id);
--
-- Do NOT drop the existing student_id UNIQUE constraint until all records
-- have been migrated to use official_id + id_classification.

-- ============================================================================
-- Rollback (for development only — review before applying to production)
-- ============================================================================
-- ALTER TABLE users
--   DROP INDEX idx_official_id,
--   DROP INDEX idx_id_classification,
--   DROP INDEX idx_role,
--   DROP INDEX idx_activation_token,
--   DROP INDEX idx_reset_token,
--   DROP COLUMN qr_code_data,
--   DROP COLUMN reset_expires,
--   DROP COLUMN reset_token,
--   DROP COLUMN activation_expires,
--   DROP COLUMN activation_token,
--   DROP COLUMN is_password_set,
--   DROP COLUMN role,
--   DROP COLUMN id_classification,
--   DROP COLUMN official_id;
