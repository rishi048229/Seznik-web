# Goal: Implement Restaurant Table Management & KOT (Kitchen Order Ticket) in Web App

We already have a shared backend (`backend/`) and PostgreSQL/Prisma database that supports multi-location, dine-in tables, and KOT orders. Please implement the complete **Restaurant Table Management & KOT Dine-In System** in our web app.

---

## 1. Database & Existing Backend Endpoints (Already Live)

The backend provides the following routes (all authenticated via `Bearer <JWT>`):

### A. Restaurant Tables
- `GET /api/restaurant-tables` — List all tables (name, capacity, status: `'available' | 'occupied' | 'reserved'`, currentOrderId, sortOrder)
- `POST /api/restaurant-tables` — Create a table: `{ name: string, capacity: number, sortOrder?: number }`
- `PUT /api/restaurant-tables/:id` — Edit table name/capacity/status
- `DELETE /api/restaurant-tables/:id` — Delete table

### B. KOT Orders
- `GET /api/kot-orders` — List active running and historical KOT tickets (supports filter query `?status=running` or `completed` | `billed` | `cancelled`)
- `GET /api/kot-orders/:id` — Fetch single KOT order with items and table details
- `POST /api/kot-orders` — Create new KOT order:
  ```json
  {
    "tableId": "uuid",
    "tableName": "Table 4",
    "waiterName": "Ramesh",
    "customerName": "John Doe",
    "customerPhone": "9876543210",
    "items": [
      {
        "productId": "uuid",
        "name": "Paneer Butter Masala",
        "quantity": 2,
        "price": 280,
        "notes": "Less spicy, extra butter",
        "printed": true
      }
    ],
    "subtotal": 560,
    "taxTotal": 28,
    "grandTotal": 588,
    "note": "Window seat"
  }
  ```
- `PUT /api/kot-orders/:id` — Update/Append items to an active running KOT (tracks newly added unprinted items vs already sent items).
- `POST /api/kot-orders/:id/checkout` (or convert to Sale) — Settles the order, creates a final `Sale` invoice, decrements inventory stock, and frees the table back to `'available'`.

---

## 2. Required Web App Pages & Components

### Page 1: Floor Plan & Tables Overview (`/kot` or `/tables`)
1. **Interactive Table Cards**:
   - Shows Table Name (e.g. `Table 1`, `VIP-2`, `Terrace-3`), Seating Capacity, Active Bill Amount, and Elapsed Time (e.g. `⏱️ 34 mins`).
   - Color-coded status badges:
     - 🟢 **Available / Vacant** (Green) — Clicking opens new KOT order modal.
     - 🔴 **Occupied / Running** (Red/Amber) — Clicking opens active running KOT to view/add items or settle bill.
     - 🟡 **Reserved / Billed** (Blue/Yellow).
2. **Floor Stats Bar**: Total Tables, Occupied Count, Vacant Count, Active Dining Revenue.
3. **Table Management Modal**: Add new table, edit seats/capacity, re-order, delete.

### Page 2: KOT Order Punching & Menu Selector (Modal / Split View)
1. **Menu Item Picker (Left/Main)**:
   - Search bar + Category tabs.
   - Quick-add cards with prices, photo thumbnails, and current stock.
   - Cooking instructions / Modifiers dialog on item click (e.g. "Extra Spicy", "No Onion/Garlic", "Pack Separately").
2. **Running Cart / KOT Ticket (Right Panel)**:
   - Header: Table Name, Waiter/Server, Order # (e.g., `#KOT-104`).
   - Section 1: **Already Sent to Kitchen** (Items with checkmark + time sent).
   - Section 2: **New Items to Print** (Highlighted in yellow/blue).
   - Actions:
     - `[ 🖨️ Send to Kitchen / Print KOT ]` — Fires KOT thermal slip format (58mm/80mm) showing Table, Waiter, and ONLY the newly added items with notes, then updates order in backend.
     - `[ 💳 Settle Bill / Checkout ]` — Opens payment settlement modal (Cash, UPI, Card, Split, Credit/Udhar). Converts KOT to finalized invoice, prints customer receipt, and resets table to Available.

### Page 3: Kitchen Display System (KDS) View (Optional / Tab: `/kot/kds`)
- Live grid of running tickets for the kitchen chef/staff.
- Shows: KOT #, Table #, elapsed time since order placed, item list with notes.
- "Mark Ready" button to notify servers.

---

## 3. Thermal Printing Support (ESC/POS & Browser Print)
- Support 58mm & 80mm thermal receipt layouts for both:
  1. **KOT Slip** (Internal Kitchen format: Large Table Name, Order Time, Waiter, Item List + Custom Notes, No pricing necessary).
  2. **Final Customer Receipt** (Business Name, GSTIN, Table #, Item Breakdown, Taxes CGST/SGST, Discount, Payment Mode, QR Code).

---

## 4. Aesthetics & Quality Standards
- Match the modern dark/light theme, sleek glassmorphism cards, micro-animations, and responsive layouts.
- Use TanStack React Query for smooth caching, instant optimistic UI updates, and zero layout shift.
- Ensure strict TypeScript typing with zero errors (`tsc --noEmit`).
