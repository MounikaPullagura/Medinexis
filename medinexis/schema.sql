CREATE DATABASE IF NOT EXISTS hospital_db;
USE hospital_db;

DROP TABLE IF EXISTS lab_reports;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS medical_records;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(15),
  password VARCHAR(255),
  role ENUM('patient','doctor','admin') DEFAULT 'patient',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  specialization VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  doctor_id INT,
  appointment_date DATETIME,
  reason VARCHAR(255),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE medical_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  doctor_id INT,
  diagnosis VARCHAR(255),
  treatment TEXT,
  record_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  doctor_id INT,
  amount DECIMAL(10,2),
  status ENUM('pending','paid') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE lab_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  doctor_id INT,
  test_type VARCHAR(100),
  result TEXT,
  report_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

INSERT INTO users (first_name, last_name, email, phone, password, role) VALUES
('Admin', 'User', 'admin@hospital.com', '9999999999', 'admin123', 'admin'),
('Ravi', 'Kumar', 'ravi@hospital.com', '8888888888', 'patient123', 'patient');

INSERT INTO doctors (user_id, specialization) VALUES (1,'Cardiology');
