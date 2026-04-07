CREATE TABLE orders (
  id VARCHAR2(50) PRIMARY KEY,
  student_id VARCHAR2(50) NOT NULL,
  cook_id VARCHAR2(50),
  total_nest_coins NUMBER NOT NULL,
  payment_method VARCHAR2(30) NOT NULL,
  payment_status VARCHAR2(30) NOT NULL,
  status VARCHAR2(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_student FOREIGN KEY (student_id) REFERENCES users(id),
  CONSTRAINT fk_orders_cook FOREIGN KEY (cook_id) REFERENCES users(id)
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

CREATE TABLE feedback (
  id VARCHAR2(50) PRIMARY KEY,
  order_id VARCHAR2(50) UNIQUE NOT NULL,
  rating NUMBER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
