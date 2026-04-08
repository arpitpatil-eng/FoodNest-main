CREATE TABLE users (
  id VARCHAR2(50) PRIMARY KEY,
  name VARCHAR2(100) NOT NULL,
  username VARCHAR2(100) UNIQUE NOT NULL,
  password_hash VARCHAR2(255) NOT NULL,
  role VARCHAR2(20) CHECK (role IN ('student', 'cook', 'delivery')) NOT NULL,
  nest_coins NUMBER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  id VARCHAR2(50) PRIMARY KEY,
  user_id VARCHAR2(50) NOT NULL,
  token VARCHAR2(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_profiles (
  user_id VARCHAR2(50) PRIMARY KEY,
  age NUMBER,
  phone VARCHAR2(30) UNIQUE NOT NULL,
  college_name VARCHAR2(150),
  hostel_address VARCHAR2(255),
  hostel_name VARCHAR2(150),
  room_number VARCHAR2(30),
  cook_experience_years NUMBER,
  cook_cuisine VARCHAR2(150),
  cook_availability VARCHAR2(100),
  delivery_contact_phone VARCHAR2(30),
  delivery_alt_phone VARCHAR2(30),
  delivery_vehicle VARCHAR2(50),
  delivery_hours VARCHAR2(100),
  delivery_shift VARCHAR2(50),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);
