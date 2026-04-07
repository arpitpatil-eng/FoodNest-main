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

CREATE TABLE order_status_history (
  id VARCHAR2(50) PRIMARY KEY,
  order_id VARCHAR2(50) NOT NULL,
  stage VARCHAR2(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  simulated NUMBER(1) DEFAULT 1 CHECK (simulated IN (0,1)),
  CONSTRAINT fk_status_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
