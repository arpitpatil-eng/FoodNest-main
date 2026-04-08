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

CREATE TABLE menu_items (
  id VARCHAR2(50) PRIMARY KEY,
  cook_id VARCHAR2(50),
  name VARCHAR2(100) NOT NULL,
  category VARCHAR2(30) NOT NULL,
  price_nest_coins NUMBER NOT NULL,
  preparation_time_mins NUMBER DEFAULT 20 NOT NULL,
  image_url VARCHAR2(500),
  description VARCHAR2(255),
  available NUMBER(1) DEFAULT 1 CHECK (available IN (0,1)),
  CONSTRAINT fk_menu_cook FOREIGN KEY (cook_id) REFERENCES users(id)
);

CREATE TABLE orders (
  id VARCHAR2(50) PRIMARY KEY,
  student_id VARCHAR2(50) NOT NULL,
  cook_id VARCHAR2(50),
  total_nest_coins NUMBER NOT NULL,
  payment_method VARCHAR2(30) NOT NULL,
  payment_status VARCHAR2(30) NOT NULL,
  status VARCHAR2(50) NOT NULL,
  payout_distributed NUMBER(1) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_student FOREIGN KEY (student_id) REFERENCES users(id),
  CONSTRAINT fk_orders_cook FOREIGN KEY (cook_id) REFERENCES users(id)
);

CREATE TABLE delivery_assignments (
  id VARCHAR2(50) PRIMARY KEY,
  order_id VARCHAR2(50) UNIQUE NOT NULL,
  delivery_partner_id VARCHAR2(50),
  delivery_status VARCHAR2(30) DEFAULT 'Pending Acceptance' NOT NULL,
  pickup_location VARCHAR2(255) DEFAULT 'Home Cook Hub' NOT NULL,
  drop_location VARCHAR2(255) DEFAULT 'Hosteller Address' NOT NULL,
  estimated_time_mins NUMBER DEFAULT 20 NOT NULL,
  distance_km NUMBER(5,2) DEFAULT 3.50 NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  picked_up_at TIMESTAMP,
  on_the_way_at TIMESTAMP,
  delivered_at TIMESTAMP,
  CONSTRAINT fk_delivery_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_delivery_partner FOREIGN KEY (delivery_partner_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id VARCHAR2(50) PRIMARY KEY,
  order_id VARCHAR2(50) NOT NULL,
  menu_item_id VARCHAR2(50) NOT NULL,
  quantity NUMBER NOT NULL,
  unit_price_nest_coins NUMBER NOT NULL,
  line_total_nest_coins NUMBER NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE order_status_history (
  id VARCHAR2(50) PRIMARY KEY,
  order_id VARCHAR2(50) NOT NULL,
  stage VARCHAR2(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  simulated NUMBER(1) DEFAULT 1 CHECK (simulated IN (0,1)),
  CONSTRAINT fk_status_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE feedback (
  id VARCHAR2(50) PRIMARY KEY,
  order_id VARCHAR2(50) UNIQUE NOT NULL,
  rating NUMBER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text VARCHAR2(500),
  reward_distributed NUMBER(1) DEFAULT 0 NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

INSERT INTO menu_items (id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available)
VALUES ('meal-1', 'Home Veg Thali', 'Veg', 80, 20, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c', 'Rice, dal, sabzi, roti, and salad.', 1);

INSERT INTO menu_items (id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available)
VALUES ('meal-2', 'Paneer Lunch Box', 'Veg', 110, 25, 'https://images.unsplash.com/photo-1606491956689-2ea866880c84', 'Paneer curry with jeera rice and roti.', 1);

INSERT INTO menu_items (id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available)
VALUES ('meal-3', 'Chicken Combo', 'Non-Veg', 140, 30, 'https://images.unsplash.com/photo-1604908176997-4314ed5d74f6', 'Chicken curry with rice and salad.', 1);

COMMIT;
