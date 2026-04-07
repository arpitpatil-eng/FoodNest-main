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
