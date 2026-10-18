CREATE DATABASE IF NOT EXISTS modul_viewer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE modul_viewer;

CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  original_file VARCHAR(255) NOT NULL,
  optimized_file VARCHAR(255) DEFAULT NULL,
  status ENUM('pending','processing','ready','failed') DEFAULT 'pending',
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;