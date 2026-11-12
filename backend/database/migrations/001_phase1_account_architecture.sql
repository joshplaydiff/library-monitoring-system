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

-- ============================================================================
-- Step 1: Add new columns to users table
-- ============================================================================

ALTER TABLE users
  ADD COLUMN official_id VARCHAR(50) NULL COMMENT 'Official UST-Legazpi ID number (string, preserves leading zeros)',
  ADD COLUMN id_classification ENUM('student', 'faculty', 'support_staff') NULL COMMENT 'University ID classification',
  ADD COLUMN role ENUM('patron', 'librarian', 'administrator') DEFAULT 'patron' COMMENT 'Application access permission',
  ADD COLUMN is_password_set TINYINT(1) DEFAULT 0 COMMENT 'Whether the patron has set their password',
  ADD COLUMN activation_token VARCHAR(255) NULL COMMENT 'SHA-256 digest of activation token',
  ADD COLUMN activation_expires DATETIME NULL COMMENT 'Activation token expiration',
  ADD COLUMN reset_token VARCHAR(255) NULL COMMENT 'SHA-256 digest of password reset token',
  ADD COLUMN reset_expires DATETIME NULL COMMENT 'Password reset token expiration',
  ADD COLUMN qr_code_data TEXT COMMENT 'Stored static QR payload (id_type + official_id)';

-- ============================================================================
-- Step 2: Add indexes
-- ============================================================================

ALTER TABLE users
  ADD INDEX idx_official_id (official_id),
  ADD INDEX idx_id_classification (id_classification),
  ADD INDEX idx_role (role),
  ADD INDEX idx_activation_token (activation_token),
  ADD INDEX idx_reset_token (reset_token);

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
