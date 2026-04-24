CREATE DATABASE IF NOT EXISTS pharmacy_db;
USE pharmacy_db;

CREATE TABLE IF NOT EXISTS users (
  User_ID INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'pharmacist',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier (
  supplier_id INT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(150) NOT NULL,
  contact_first VARCHAR(80) NOT NULL,
  contact_last VARCHAR(80) NOT NULL,
  contact_number VARCHAR(30),
  address VARCHAR(255),
  license_number VARCHAR(80) UNIQUE,
  rating FLOAT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS medicine (
  medicine_id INT PRIMARY KEY AUTO_INCREMENT,
  medicine_name VARCHAR(150) NOT NULL,
  brand_name VARCHAR(150),
  generic_name VARCHAR(150),
  category VARCHAR(100),
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 0,
  current_stock INT NOT NULL DEFAULT 0,
  storage_type VARCHAR(100)
);

ALTER TABLE medicine
  ADD COLUMN IF NOT EXISTS current_stock INT NOT NULL DEFAULT 0 AFTER min_stock_level;

CREATE TABLE IF NOT EXISTS doctor (
  doctor_id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  specialization VARCHAR(120),
  contact VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS patient (
  patient_id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  age INT,
  gender VARCHAR(20),
  contact VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS purchase_order (
  po_id INT PRIMARY KEY AUTO_INCREMENT,
  order_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Pending',
  supplier_id INT NOT NULL,
  CONSTRAINT fk_purchase_order_supplier
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS batch (
  batch_id INT PRIMARY KEY AUTO_INCREMENT,
  batch_number VARCHAR(100) NOT NULL UNIQUE,
  manufacture_date DATE,
  expiry_date DATE NOT NULL,
  batch_quantity INT NOT NULL DEFAULT 0,
  medicine_id INT NOT NULL,
  CONSTRAINT fk_batch_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicine(medicine_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prescription (
  prescription_id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  customer_name VARCHAR(200) NOT NULL DEFAULT 'Walk-in Customer',
  doctor_id INT NOT NULL,
  patient_id INT DEFAULT NULL,
  notes VARCHAR(500) DEFAULT NULL,
  CONSTRAINT fk_prescription_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_prescription_patient
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prescription_medicine (
  prescription_id INT NOT NULL,
  medicine_id INT NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (prescription_id, medicine_id),
  CONSTRAINT fk_prescription_medicine_prescription
    FOREIGN KEY (prescription_id) REFERENCES prescription(prescription_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_prescription_medicine_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicine(medicine_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS po_medicine (
  po_id INT NOT NULL,
  medicine_id INT NOT NULL,
  quantity INT NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (po_id, medicine_id),
  CONSTRAINT fk_po_medicine_po
    FOREIGN KEY (po_id) REFERENCES purchase_order(po_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_po_medicine_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicine(medicine_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

UPDATE medicine m
LEFT JOIN (
  SELECT medicine_id, COALESCE(SUM(batch_quantity), 0) AS batch_stock
  FROM batch
  GROUP BY medicine_id
) b ON b.medicine_id = m.medicine_id
LEFT JOIN (
  SELECT medicine_id, COALESCE(SUM(quantity), 0) AS dispensed_stock
  FROM prescription_medicine
  GROUP BY medicine_id
) p ON p.medicine_id = m.medicine_id
SET m.current_stock = GREATEST(COALESCE(b.batch_stock, 0) - COALESCE(p.dispensed_stock, 0), 0);

DROP TRIGGER IF EXISTS medicine_batch_after_insert;
DROP TRIGGER IF EXISTS medicine_batch_after_update;
DROP TRIGGER IF EXISTS medicine_batch_after_delete;
DROP TRIGGER IF EXISTS medicine_prescription_medicine_before_insert;
DROP TRIGGER IF EXISTS medicine_prescription_medicine_after_delete;

DELIMITER $$

CREATE TRIGGER medicine_batch_after_insert
AFTER INSERT ON batch
FOR EACH ROW
BEGIN
  UPDATE medicine
  SET current_stock = current_stock + NEW.batch_quantity
  WHERE medicine_id = NEW.medicine_id;
END$$

CREATE TRIGGER medicine_batch_after_update
AFTER UPDATE ON batch
FOR EACH ROW
BEGIN
  UPDATE medicine
  SET current_stock = current_stock
    - CASE WHEN medicine_id = OLD.medicine_id THEN OLD.batch_quantity ELSE 0 END
    + CASE WHEN medicine_id = NEW.medicine_id THEN NEW.batch_quantity ELSE 0 END
  WHERE medicine_id IN (OLD.medicine_id, NEW.medicine_id);
END$$

CREATE TRIGGER medicine_batch_after_delete
AFTER DELETE ON batch
FOR EACH ROW
BEGIN
  UPDATE medicine
  SET current_stock = GREATEST(current_stock - OLD.batch_quantity, 0)
  WHERE medicine_id = OLD.medicine_id;
END$$

CREATE TRIGGER medicine_prescription_medicine_before_insert
BEFORE INSERT ON prescription_medicine
FOR EACH ROW
BEGIN
  DECLARE available_stock INT;

  SELECT current_stock INTO available_stock
  FROM medicine
  WHERE medicine_id = NEW.medicine_id;

  IF available_stock IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medicine not found';
  END IF;

  IF available_stock < NEW.quantity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient medicine stock';
  END IF;

  UPDATE medicine
  SET current_stock = current_stock - NEW.quantity
  WHERE medicine_id = NEW.medicine_id;
END$$

CREATE TRIGGER medicine_prescription_medicine_after_delete
AFTER DELETE ON prescription_medicine
FOR EACH ROW
BEGIN
  UPDATE medicine
  SET current_stock = current_stock + OLD.quantity
  WHERE medicine_id = OLD.medicine_id;
END$$

DELIMITER ;

-- ═══════════════════════════════════════════════════════════════════
-- PharmaCare Pro upgrades
-- ═══════════════════════════════════════════════════════════════════

-- DB-level date integrity for batch table (MySQL 8.0.16+)
-- Prevents manufacture_date >= expiry_date at DB level
-- (Application layer also validates; this is the last line of defense)
ALTER TABLE batch
  ADD CONSTRAINT IF NOT EXISTS chk_batch_mfg_before_expiry
    CHECK (manufacture_date IS NULL OR manufacture_date < expiry_date);

-- Activity log (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  action_type VARCHAR(50) NOT NULL COMMENT 'batch_added, stock_adjusted, prescription_created, prescription_deleted, po_created, po_status_changed',
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  description TEXT NOT NULL,
  quantity_change INT DEFAULT NULL,
  medicine_id INT DEFAULT NULL,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(User_ID) ON DELETE SET NULL
);

-- ─── Additional validation constraints ───────────────────────────────────────
ALTER TABLE medicine
  ADD CONSTRAINT IF NOT EXISTS chk_medicine_price_positive CHECK (unit_price >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_medicine_min_stock CHECK (min_stock_level >= 0);

ALTER TABLE batch
  ADD CONSTRAINT IF NOT EXISTS chk_batch_qty_positive CHECK (batch_quantity > 0);

ALTER TABLE patient
  ADD CONSTRAINT IF NOT EXISTS chk_patient_age CHECK (age IS NULL OR (age >= 0 AND age <= 150));

ALTER TABLE supplier
  ADD CONSTRAINT IF NOT EXISTS chk_supplier_rating CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

ALTER TABLE po_medicine
  ADD CONSTRAINT IF NOT EXISTS chk_po_medicine_qty CHECK (quantity > 0),
  ADD CONSTRAINT IF NOT EXISTS chk_po_medicine_price CHECK (purchase_price >= 0);
