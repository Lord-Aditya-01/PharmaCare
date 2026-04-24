# PharmaCare Pro

A production-ready Hospital Pharmacy Management System built with **React + Vite** (frontend) and **Node.js + Express + MySQL** (backend).

## Stack
- **Frontend:** React 18, React Router 6, Recharts, Tailwind CSS, Lucide icons, Axios
- **Backend:** Node.js, Express, MySQL2, JWT auth, bcrypt
- **Database:** MySQL 8+

## Features
- **Dashboard** — Live stats: medicines, stock, low stock, out-of-stock, expiring batches, prescriptions (30d), pending orders. Charts: monthly spend (6mo area chart), expiry risk, top prescribed medicines
- **Medicines** — Full CRUD with stock level tracking. Color-coded low/out-of-stock badges. Min stock level alerts
- **Batches** — Date-validated (manufacture < expiry, no future dates). Expiry color coding. Bulk CSV import (up to 500 rows) with template download
- **Prescriptions** — Multi-medicine prescription builder. Real-time stock validation before dispatch. Expand row to view medicines
- **Purchase Orders** — Status badges (Pending/Approved/Received/Cancelled). Supplier name display
- **Suppliers** — Contact info + star rating display
- **Patients / Doctors** — Full CRUD with field validation
- **Reports** (3 tabs):
  - **Inventory** — Filter by category, stock status, search. CSV export
  - **Expiry Tracker** — Filter by days/urgency. Critical/Warning/Notice badges. CSV export  
  - **Purchase History** — Filter by supplier, status, date range

## Setup

### 1. Database
```sql
mysql -u root -p < database/schema.sql
mysql -u root -p < database/sample_data.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # Edit with your DB credentials
npm install
npm run dev
```

Default `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=pharmacy_db
JWT_SECRET=your_jwt_secret_here
PORT=5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

## Validation Logic (3-Layer)

### Batch Dates
1. **Frontend:** `clientValidate` prop on EntityPage — shows inline error before API call
2. **Backend:** `validateBatchDates()` in batchController.js — returns HTTP 400 with message
3. **Database:** `CHECK (manufacture_date IS NULL OR manufacture_date < expiry_date)` constraint

### Rules enforced:
- `expiry_date` must be a future date (not today, not past)
- `manufacture_date` must be before `expiry_date`
- `manufacture_date` cannot be in the future
- `batch_quantity` must be a positive integer

### Prescription Stock
- Dropdown disables out-of-stock medicines
- Client checks cumulative quantity against available stock before adding
- Server trigger enforces stock deduction atomically

## Bulk CSV Import (Batches)
Format:
```csv
batch_number,manufacture_date,expiry_date,batch_quantity,medicine_id
BATCH-001,2024-01-01,2027-01-01,100,1
BATCH-002,,2027-06-30,50,2
```
- `manufacture_date` is optional
- All rows validated before any DB write (atomic)
- Max 500 rows per import
- Download template from the Batches page
