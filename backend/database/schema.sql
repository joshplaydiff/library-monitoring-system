-- Library Monitoring System Database Schema
-- Database: library_system

-- Create database if not exists (run this first if needed)
-- CREATE DATABASE IF NOT EXISTS library_system;
-- USE library_system;

-- Users table (registered library users)
-- NOTE: student_id is preserved for backward compatibility.
-- New columns: official_id, id_classification, role
-- official_id: the patron's official university ID number (string, preserves leading zeros)
-- id_classification: Student, Faculty, or Support Staff (university classification)
-- role: Patron, Librarian, or Administrator (application access permission)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NULL,
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
    INDEX idx_student_id (student_id),
    INDEX idx_official_id (official_id),
    INDEX idx_user_type (user_type),
    INDEX idx_id_classification (id_classification),
    INDEX idx_role (role),
    INDEX idx_activation_token (activation_token),
    INDEX idx_reset_token (reset_token),
    INDEX idx_department (department)
);

-- Visit logs table
CREATE TABLE IF NOT EXISTS visit_logs (
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
    INDEX idx_user_type (user_type),
    INDEX idx_timestamp (timestamp),
    INDEX idx_log_type (log_type),
    INDEX idx_section (section),
    INDEX idx_room_id (room_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(50) UNIQUE,
    genre VARCHAR(100),
    copies INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    status ENUM('available', 'borrowed', 'maintenance', 'lost') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_isbn (isbn),
    INDEX idx_status (status)
);

-- Book transactions table
CREATE TABLE IF NOT EXISTS book_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_type ENUM('borrow', 'return', 'reserve') DEFAULT 'borrow',
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    return_date DATETIME DEFAULT NULL,
    renewed TINYINT(1) DEFAULT 0,
    fine_amount DECIMAL(10,2) DEFAULT 0,
    status ENUM('pending', 'active', 'returned', 'overdue', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_book_id (book_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Book reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    user_id INT NOT NULL,
    preferred_date DATE,
    status ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed') DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_book_id (book_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fines table
CREATE TABLE IF NOT EXISTS fines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT,
    transaction_id INT,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status ENUM('unpaid', 'paid', 'waived') DEFAULT 'unpaid',
    paid_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
    FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE SET NULL
);

-- Suggestions table
CREATE TABLE IF NOT EXISTS suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20),
    notes TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT,
    reviewed_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    library VARCHAR(255) NOT NULL,
    floor VARCHAR(50),
    section ENUM('Main Library', 'Learning Commons', 'Meeting Room') DEFAULT 'Main Library',
    room_type ENUM('study', 'computer', 'group', 'meeting', 'archive', 'other') DEFAULT 'study',
    capacity INT DEFAULT 10,
    status ENUM('available', 'occupied', 'maintenance', 'reserved') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_library (library),
    INDEX idx_section (section)
);

-- Room reservations table
CREATE TABLE IF NOT EXISTS room_reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    purpose TEXT,
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_reservation_date (reservation_date),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample rooms
INSERT INTO rooms (room_name, library, floor, section, room_type, capacity, status) VALUES
('Main Library - Ground Floor', 'Main Library', 'Ground', 'Main Library', 'study', 50, 'available'),
('Computer Laboratory 1', 'Main Library', '2nd', 'Main Library', 'computer', 30, 'available'),
('Group Study Room A', 'Main Library', '2nd', 'Main Library', 'group', 10, 'available'),
('Group Study Room B', 'Main Library', '2nd', 'Main Library', 'group', 10, 'available'),
('Archives Room', 'Main Library', '3rd', 'Main Library', 'archive', 20, 'available'),
('Conference Room', 'Main Library', '3rd', 'Meeting Room', 'meeting', 15, 'available'),
('Learning Commons - Study Area', 'Learning Commons', '3rd', 'Learning Commons', 'study', 40, 'available'),
('Learning Commons - Computer Area', 'Learning Commons', '3rd', 'Learning Commons', 'computer', 25, 'available'),
('Discussion Room 1', 'Learning Commons', '3rd', 'Meeting Room', 'meeting', 12, 'available'),
('Discussion Room 2', 'Learning Commons', '3rd', 'Meeting Room', 'meeting', 12, 'available')
ON DUPLICATE KEY UPDATE room_name = VALUES(room_name);

-- Sample data for testing

-- Insert sample users
INSERT INTO users (student_id, full_name, email, user_type, department, course, year_level, password_hash) VALUES
('2021001', 'Juan Dela Cruz', 'juan.delacruz@ust.edu.ph', 'student', 'College of Engineering', 'BS Computer Engineering', '3rd Year', '$2a$10$rOzJqJqJqJqJqJqJqJqJqO'),
('2021002', 'Maria Santos', 'maria.santos@ust.edu.ph', 'student', 'College of Arts and Sciences', 'BS Psychology', '2nd Year', '$2a$10$rOzJqJqJqJqJqJqJqJqJqO'),
('2021003', 'Pedro Garcia', 'pedro.garcia@ust.edu.ph', 'faculty', 'College of Business', 'MBA', 'N/A', '$2a$10$rOzJqJqJqJqJqJqJqJqJqO'),
('2021004', 'Ana Reyes', 'ana.reyes@ust.edu.ph', 'student', 'College of Nursing', 'BS Nursing', '4th Year', '$2a$10$rOzJqJqJqJqJqJqJqJqJqO'),
('2021005', 'Carlos Mendoza', 'carlos.mendoza@ust.edu.ph', 'staff', 'Library', 'N/A', 'N/A', '$2a$10$rOzJqJqJqJqJqJqJqJqJqO')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- Insert sample books
INSERT INTO books (title, author, isbn, genre, copies, available_copies, status) VALUES
('Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 'Computer Science', 5, 5, 'available'),
('Clean Code', 'Robert C. Martin', '9780132350884', 'Software Engineering', 3, 3, 'available'),
('The Pragmatic Programmer', 'Andrew Hunt, David Thomas', '9780201616224', 'Software Engineering', 4, 4, 'available'),
('Database System Concepts', 'Abraham Silberschatz', '9780073523323', 'Database', 2, 2, 'available'),
('Artificial Intelligence: A Modern Approach', 'Stuart Russell', '9780136042594', 'Artificial Intelligence', 3, 3, 'available'),
('Psychology 101', 'John Santrock', '9781260784997', 'Psychology', 2, 2, 'available')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Insert sample rooms
INSERT INTO rooms (room_name, library, floor, section, room_type, capacity, status) VALUES
('Main Library - Ground Floor', 'Main Library', 'Ground', 'Main Library', 'study', 50, 'available'),
('Computer Laboratory 1', 'Main Library', '2nd', 'Main Library', 'computer', 30, 'available'),
('Group Study Room A', 'Main Library', '2nd', 'Main Library', 'group', 10, 'available'),
('Group Study Room B', 'Main Library', '2nd', 'Main Library', 'group', 10, 'available'),
('Archives Room', 'Main Library', '3rd', 'Main Library', 'archive', 20, 'available'),
('Conference Room', 'Main Library', '3rd', 'Meeting Room', 'meeting', 15, 'available'),
('Learning Commons - Study Area', 'Learning Commons', '3rd', 'Learning Commons', 'study', 40, 'available'),
('Learning Commons - Computer Area', 'Learning Commons', '3rd', 'Learning Commons', 'computer', 25, 'available'),
('Discussion Room 1', 'Learning Commons', '3rd', 'Meeting Room', 'meeting', 12, 'available'),
('Discussion Room 2', 'Learning Commons', '3rd', 'Meeting Room', 'meeting', 12, 'available')
ON DUPLICATE KEY UPDATE room_name = VALUES(room_name);

-- Insert sample visit logs for testing
INSERT INTO visit_logs (user_id, user_type, name, purpose, section, room_id, log_type, timestamp, synced) VALUES
(1, 'student', 'Juan Dela Cruz', 'Study', 'Main Library', 3, 'entry', NOW() - INTERVAL 2 HOUR, 1),
(2, 'student', 'Maria Santos', 'Research', 'Learning Commons', 7, 'entry', NOW() - INTERVAL 3 HOUR, 1),
(3, 'faculty', 'Pedro Garcia', 'Grading', 'Main Library', NULL, 'entry', NOW() - INTERVAL 1 HOUR, 1),
(1, 'student', 'Juan Dela Cruz', 'Study', 'Main Library', 3, 'exit', NOW() - INTERVAL 30 MINUTE, 1),
(4, 'student', 'Ana Reyes', 'Borrowing Books', 'Main Library', NULL, 'entry', NOW() - INTERVAL 15 MINUTE, 1);

-- Insert sample book transactions
INSERT INTO book_transactions (book_id, user_id, transaction_type, borrow_date, due_date, return_date, status) VALUES
(1, 1, 'borrow', NOW() - INTERVAL 7 DAY, NOW() + INTERVAL 7 DAY, NULL, 'active'),
(3, 2, 'borrow', NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 4 DAY, NULL, 'active'),
(5, 4, 'borrow', NOW() - INTERVAL 14 DAY, NOW() - INTERVAL 7 DAY, NOW() - INTERVAL 1 DAY, 'returned');

-- Import batches table for tracking CSV imports
CREATE TABLE IF NOT EXISTS import_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    total_records INT DEFAULT 0,
    successful_imports INT DEFAULT 0,
    failed_imports INT DEFAULT 0,
    imported_by VARCHAR(255),
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_batch_id (batch_id)
);

-- Analytics snapshots for reliable reporting
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period ENUM('day', 'week', 'month') DEFAULT 'week',
    section VARCHAR(255),
    room_id INT DEFAULT NULL,
    total_visits INT DEFAULT 0,
    entries INT DEFAULT 0,
    exits INT DEFAULT 0,
    currently_inside INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    average_daily_visits INT DEFAULT 0,
    peak_hour INT DEFAULT 0,
    peak_day VARCHAR(50),
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_period (period),
    INDEX idx_section (section),
    INDEX idx_created_at (created_at)
);

-- Insert sample room reservations
INSERT INTO room_reservations (room_id, user_id, purpose, reservation_date, start_time, end_time, status) VALUES
(3, 1, 'Group Study', CURDATE(), '09:00:00', '12:00:00', 'approved'),
(4, 2, 'Project Discussion', CURDATE(), '14:00:00', '17:00:00', 'pending');

-- Report subscribers for scheduled reports
CREATE TABLE IF NOT EXISTS report_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    frequency ENUM('daily', 'weekly', 'monthly') DEFAULT 'weekly',
    report_types JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_frequency (frequency)
);

-- Report history
CREATE TABLE IF NOT EXISTS report_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    period VARCHAR(50) NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recipient_count INT DEFAULT 0,
    status ENUM('sent', 'failed', 'partial') DEFAULT 'sent',
    error_message TEXT,
    INDEX idx_report_type (report_type),
    INDEX idx_generated_at (generated_at)
);

-- Standard cataloging table (MARC-inspired bibliographic records)
CREATE TABLE IF NOT EXISTS catalog_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- Main entry
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    author_type ENUM('personal', 'corporate', 'conference') DEFAULT 'personal',
    added_author VARCHAR(255),
    editor VARCHAR(255),
    
    -- Publication info
    publisher VARCHAR(255),
    publication_place VARCHAR(255),
    publication_date DATE,
    edition VARCHAR(100),
    
    -- Physical description
    pages VARCHAR(100),
    illustrations VARCHAR(100),
    dimensions VARCHAR(50),
    
    -- Series / related info
    series_title VARCHAR(500),
    series_volume VARCHAR(50),
    series_issue VARCHAR(50),
    
    -- Identifiers
    isbn VARCHAR(50) UNIQUE,
    issn VARCHAR(50),
    oclc_number VARCHAR(50),
    local_call_number VARCHAR(100),
    accession_number VARCHAR(100) UNIQUE,
    
    -- Subject analysis
    subject_headings TEXT,
    keywords TEXT,
    dewey_decimal VARCHAR(50),
    library_of_congress VARCHAR(50),
    
    -- Notes
    general_notes TEXT,
    bibliography_notes TEXT,
    table_of_contents TEXT,
    summary TEXT,
    
    -- Classification
    material_type ENUM('book', 'journal', 'thesis', 'reference', 'multimedia', 'other') DEFAULT 'book',
    language VARCHAR(50) DEFAULT 'English',
    
    -- Cataloging metadata
    cataloging_source VARCHAR(255),
    cataloger VARCHAR(255),
    cataloging_date DATE,
    last_revision_date DATE,
    revision_note TEXT,
    
    -- Status and tracking
    status ENUM('cataloged', 'pending', 'in_process', 'withdrawn') DEFAULT 'cataloged',
    copies_total INT DEFAULT 1,
    copies_available INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_isbn (isbn),
    INDEX idx_call_number (local_call_number),
    INDEX idx_author (author),
    INDEX idx_status (status),
    INDEX idx_material_type (material_type)
);

-- ============================================================================
-- MIGRATION NOTES (Phase 1 - Account Role Architecture)
-- ============================================================================
-- The following ALTER TABLE statements are provided for applying Phase 1 changes
-- to an EXISTING database without destroying data. Do NOT run these automatically
-- without first taking a verified MySQL backup (mysqldump or MySQL Workbench export).
--
-- Run these statements manually in MySQL Workbench or via mysql client:
--
-- ALTER TABLE users
--   ADD COLUMN official_id VARCHAR(50) NULL AFTER student_id,
--   ADD COLUMN id_classification ENUM('student','faculty','support_staff') NULL AFTER official_id,
--   ADD COLUMN role ENUM('patron','librarian','administrator') DEFAULT 'patron' AFTER user_type,
--   ADD COLUMN is_password_set TINYINT(1) DEFAULT 0 AFTER qr_code_data,
--   ADD COLUMN activation_token VARCHAR(255) NULL AFTER is_password_set,
--   ADD COLUMN activation_expires DATETIME NULL AFTER activation_token,
--   ADD COLUMN reset_token VARCHAR(255) NULL AFTER activation_expires,
--   ADD COLUMN reset_expires DATETIME NULL AFTER reset_token,
--   ADD INDEX idx_official_id (official_id),
--   ADD INDEX idx_id_classification (id_classification),
--   ADD INDEX idx_role (role),
--   ADD INDEX idx_activation_token (activation_token),
--   ADD INDEX idx_reset_token (reset_token);
--
-- Backfill existing records:
--   UPDATE users SET role = 'patron' WHERE role IS NULL;
--   UPDATE users SET is_password_set = 1 WHERE password_hash IS NOT NULL AND password_hash != '';
--   UPDATE users SET is_password_set = 0 WHERE password_hash IS NULL OR password_hash = '';
--
-- After backfill, optionally enforce composite uniqueness on (id_classification, official_id):
--   ALTER TABLE users ADD UNIQUE KEY uk_classification_official_id (id_classification, official_id);
--
-- Note: Do NOT drop the existing student_id UNIQUE constraint until all existing
-- records have been migrated to use official_id + id_classification. Dropping it
-- prematurely could allow ID collisions across classifications.
-- ============================================================================