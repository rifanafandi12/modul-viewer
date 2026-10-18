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

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert admin default (password: admin123)
-- Hash di bawah ini di-generate menggunakan bcrypt dengan salt 10
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$10$wT/9U.p8B1xO2G3z4H5j6uK7l8M9n0O1p2Q3r4S5t6U7v8W9x0Y1z') 
ON DUPLICATE KEY UPDATE username = username;