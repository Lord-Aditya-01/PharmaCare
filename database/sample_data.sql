USE pharmacy_db;

INSERT INTO supplier (company_name, contact_first, contact_last, contact_number, address, license_number, rating) VALUES
('MediCore Distributors', 'Rohan', 'Verma', '9876543210', '12 Market Road, Pune', 'LIC-MED-1001', 4.7),
('Lifeline Pharma Supply', 'Anita', 'Kulkarni', '9876543211', '88 MG Road, Mumbai', 'LIC-MED-1002', 4.3),
('Apex Pharma', 'Suresh', 'Naik', '9876543212', '5 Station Road, Nashik', 'LIC-MED-1003', 3.8);

INSERT INTO medicine (medicine_name, brand_name, generic_name, category, unit_price, min_stock_level, storage_type) VALUES
('Paracetamol 500mg', 'MediCalm', 'Paracetamol', 'Analgesic', 2.50, 100, 'Room Temperature'),
('Amoxicillin 250mg', 'AmoxiCare', 'Amoxicillin', 'Antibiotic', 6.75, 80, 'Cool Dry Place'),
('Cetirizine 10mg', 'AllerFree', 'Cetirizine', 'Antihistamine', 1.80, 60, 'Room Temperature'),
('Metformin 500mg', 'Glucophage', 'Metformin', 'Antidiabetic', 4.20, 100, 'Room Temperature'),
('Ibuprofen 400mg', 'Motrin', 'Ibuprofen', 'NSAID', 3.50, 50, 'Room Temperature'),
('Omeprazole 20mg', 'Omez', 'Omeprazole', 'Antacid', 5.00, 40, 'Room Temperature');

INSERT INTO batch (batch_number, manufacture_date, expiry_date, batch_quantity, medicine_id) VALUES
('PCM-2026-A', '2026-01-01', '2028-01-01', 500, 1),
('AMX-2026-B', '2026-02-10', '2027-06-15', 200, 2),
('CTZ-2026-C', '2026-03-05', '2027-03-05', 300, 3),
('MTF-2026-A', '2025-06-01', '2027-12-01', 400, 4),
('IBU-2026-A', '2026-01-15', '2028-01-15', 600, 5),
('OMZ-2026-A', '2026-02-01', '2027-02-01', 250, 6);

INSERT INTO doctor (first_name, last_name, specialization, contact) VALUES
('Meera', 'Sharma', 'General Medicine', '9000011111'),
('Arjun', 'Patel', 'Pediatrics', '9000022222'),
('Neha', 'Joshi', 'Internal Medicine', '9000033333');

INSERT INTO patient (first_name, last_name, age, gender, contact) VALUES
('Nikhil', 'Joshi', 34, 'Male', '9111111111'),
('Priya', 'Kale', 27, 'Female', '9222222222'),
('Ramesh', 'Patil', 55, 'Male', '9333333333');

INSERT INTO purchase_order (order_date, total_amount, status, supplier_id) VALUES
('2026-04-10', 18500.00, 'Received', 1),
('2026-04-15', 9200.00, 'Received', 2),
('2026-04-20', 6300.00, 'Pending', 3);

INSERT INTO po_medicine (po_id, medicine_id, quantity, purchase_price) VALUES
(1, 1, 1000, 2.10),
(1, 2, 500, 6.10),
(2, 3, 800, 1.40),
(3, 4, 500, 4.00),
(3, 5, 300, 3.20);

INSERT INTO prescription (date, customer_name, doctor_id, patient_id, notes) VALUES
('2026-04-20', 'Nikhil Joshi', 1, 1, 'Take after food'),
('2026-04-21', 'Walk-in Customer', 2, NULL, NULL),
('2026-04-22', 'Priya Kale', 3, 2, 'Allergy season dosage');

INSERT INTO prescription_medicine (prescription_id, medicine_id, dosage, quantity) VALUES
(1, 1, '1 tablet twice daily after food', 10),
(1, 3, '1 tablet at night', 5),
(2, 5, '1 tablet after meals', 6),
(3, 3, '1 tablet at night', 7),
(3, 6, '1 capsule before food', 5);
