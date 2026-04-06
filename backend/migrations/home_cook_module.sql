ALTER TABLE menu_items ADD (cook_id VARCHAR2(50));
ALTER TABLE menu_items ADD (preparation_time_mins NUMBER DEFAULT 20 NOT NULL);
ALTER TABLE menu_items ADD (image_url VARCHAR2(500));
ALTER TABLE menu_items
  ADD CONSTRAINT fk_menu_cook FOREIGN KEY (cook_id) REFERENCES users(id);

ALTER TABLE orders ADD (cook_id VARCHAR2(50));
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_cook FOREIGN KEY (cook_id) REFERENCES users(id);

UPDATE menu_items
SET preparation_time_mins = 20
WHERE preparation_time_mins IS NULL;

COMMIT;
