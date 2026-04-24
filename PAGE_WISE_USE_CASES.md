# PharmaCare Page-wise Use Cases and User Feature Mapping

## Purpose
This document explains:
- What each page is used for
- Which users benefit from each page
- Which features are available now vs planned by role

## Current Access Model (Important)
- Login and registration are implemented.
- A user role value is stored (default: pharmacist).
- Role-based page restrictions are not enforced in the current frontend/backend routes.
- So currently, all authenticated users can access the same modules.

## Page-wise Use Cases

### 1. Login and Register
- Route: /login, /register
- Primary use case:
  - Authenticate staff and open protected modules
- Key features:
  - Login with email and password
  - Register new account
  - JWT token-based session
- Main user types:
  - Pharmacist
  - Inventory staff
  - Admin

### 2. Dashboard
- Route: /
- Primary use case:
  - Fast operational overview for medicine, inventory, and expiry risk
- Key features:
  - Summary cards (medicine count, stock units, low-stock medicines, supplier/patient/doctor counts)
  - Expiry notification with quick jump to batches
  - Top prescribed medicines chart
  - Monthly purchase spend chart
  - Expiry risk distribution with stock value
  - Export inventory report as CSV
- Main user types:
  - Pharmacist
  - Store manager
  - Admin

### 3. Medicines
- Route: /medicines
- Primary use case:
  - Maintain medicine master data and monitor stock status
- Key features:
  - Add/edit/delete medicine records
  - Search, sort, pagination
  - Current stock and batch count visibility
  - Minimum stock threshold tracking
- Main user types:
  - Pharmacist
  - Inventory manager
  - Admin

### 4. Suppliers
- Route: /suppliers
- Primary use case:
  - Maintain supplier master records used for purchasing
- Key features:
  - Add/edit/delete supplier profiles
  - Contact, license, and rating management
  - Search, sort, pagination
- Main user types:
  - Procurement officer
  - Store manager
  - Admin

### 5. Purchase Orders
- Route: /purchase-orders
- Primary use case:
  - Create and track medicine procurement orders
- Key features:
  - Add/edit/delete purchase orders
  - Supplier linkage
  - Amount and status tracking (Pending/Approved/Received/Cancelled)
  - Search, sort, pagination
- Main user types:
  - Procurement officer
  - Store manager
  - Admin

### 6. Batches
- Route: /batches
- Primary use case:
  - Track medicine lots for quantity and expiry lifecycle
- Key features:
  - Add/edit/delete batch details
  - Batch quantity and medicine link
  - Manufacture and expiry date tracking
  - Expiry alert bar (next 60 days)
- Main user types:
  - Inventory staff
  - Pharmacist
  - Store manager

### 7. Doctors
- Route: /doctors
- Primary use case:
  - Maintain doctor records for prescription creation
- Key features:
  - Add/edit/delete doctor records
  - Search, sort, pagination
- Main user types:
  - Pharmacist
  - Front desk/data entry
  - Admin

### 8. Patients
- Route: /patients
- Primary use case:
  - Maintain patient records used in prescriptions
- Key features:
  - Add/edit/delete patient records
  - Demographic and contact data
  - Search, sort, pagination
- Main user types:
  - Pharmacist
  - Front desk/data entry
  - Admin

### 9. Prescriptions
- Route: /prescriptions
- Primary use case:
  - Create and manage medicine issue records for patients
- Key features:
  - Prescription header with date, doctor, and patient
  - Multi-medicine line items with dosage and quantity
  - Delete prescription
  - Search prescription list
- Main user types:
  - Pharmacist
  - Dispensing desk
  - Admin

## Feature Matrix by User Type

Legend:
- Full: Should actively use in day-to-day work
- View: Useful as read-only for decisions/review
- Limited: Occasional or support usage
- Not Primary: Usually not needed in normal workflow

| Module/Page | Pharmacist | Inventory Staff | Procurement Officer | Store Manager | Front Desk/Data Entry | Admin |
|---|---|---|---|---|---|---|
| Login/Register | Full | Full | Full | Full | Full | Full |
| Dashboard | Full | View | View | Full | Limited | Full |
| Export Reports (Inventory CSV) | Full | Full | View | Full | Not Primary | Full |
| Medicines | Full | Full | View | Full | Limited | Full |
| Suppliers | Limited | Limited | Full | Full | Not Primary | Full |
| Purchase Orders | Limited | Limited | Full | Full | Not Primary | Full |
| Batches | Full | Full | Limited | Full | Not Primary | Full |
| Doctors | Limited | Not Primary | Not Primary | Limited | Full | Full |
| Patients | Limited | Not Primary | Not Primary | Limited | Full | Full |
| Prescriptions | Full | Limited | Not Primary | View | Limited | Full |

## Notes for Implementation Planning
- Current system behavior: all authenticated users can currently access all pages.
- Recommended next step: enforce role checks in both frontend route guards and backend middleware.
- Suggested first RBAC split:
  - Pharmacist: Dashboard, Medicines, Batches, Prescriptions, Doctors, Patients
  - Procurement: Dashboard, Suppliers, Purchase Orders, Medicines (view)
  - Inventory: Dashboard, Medicines, Batches
  - Admin: Full access
