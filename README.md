# Seznik Web - POS & Inventory Management System

A modern full-stack Point of Sale (POS) and Inventory Management System built for retail stores, featuring real-time hardware printer SDK integration, custom barcode label design, workstation access security, and full database persistence.

---

## 🌟 Key Features

### 🔐 Authentication, Workstation Security & Password Reset
- **Database Auth & Role Enforcement**: Main owner accounts (Admin) and sub-accounts (Agents) authenticate against hashed passwords stored in PostgreSQL.
- **Workstation Access Verification**: Workstation role selection requires password confirmation against backend database records.
- **OTP Password Reset Workflow**: Interactive 4-step forgot password system sending 6-digit verification codes via SMTP to user email addresses, allowing secure password updates in PostgreSQL.

### 🖨️ Printers Management & Configuration Dashboard (`/printers`)
- **Connected Hardware Drivers Status**:
  - **Seznik Veer Thermal Receipt Driver (v2.4)**: ESC/POS 58mm & 80mm high-speed receipt printing.
  - **Seznik Multi-Format Dual Engine SDK (v3.1)**: Dual Engine (TSPL Labels + POS Thermal + Page Mode).
  - **System Web & PDF Spooler**: Standard desktop inkjet / laser printer driver.
- **Web Bluetooth Scanner & Auto-Reconnect**: Auto-reconnects known Bluetooth printers (`blePrinter`) and allows one-click pairing for wireless thermal label printers.
- **Gap Auto-Calibration**: One-click hardware gap sensor auto-calibration (`GAPDETECT / AUTO GAP`) over Bluetooth BLE.

### 🏷️ Interactive Label Designer & Barcode / QR Generator
- **Product Inventory Binding**: Select any product from inventory (`useProducts`) to preview and print labels with real Product Name, Price (₹ INR), and Barcode/SKU.
- **Barcode & QR Symbologies**: Generates **Code 128**, **EAN-13**, and **2D QR Codes**.
- **Custom Element Layout Builder**: Add, remove, reorder, align (left/center/right), bold, and scale (2×) label elements (Business Title, Product Name, Price, Barcode/QR, and Custom Text).
- **Dual Protocol Encoder**:
  - **TSPL Mode (Gap Sensing)**: Emits `SIZE 50 mm, 30 mm` and `GAP 2 mm, 0 mm` commands for 100% gap-aligned single-sticker printing.
  - **ESC/POS Compact Mode**: Scaled module size 3 for small thermal paper rolls.

### 📄 Invoice & Thermal Receipt Customization
- **Thermal Receipts**: 58mm vs 80mm paper widths, store logo toggles, GSTIN display, itemized breakdowns, subtotals, invoice barcodes, and auto-cut commands.
- **A4 Full Invoices**: Color palette themes (Navy, Emerald, Slate, Royal Blue), terms & conditions, and UPI Payment QR code.
- **Database Settings Persistence**: All printer, label, and receipt configurations persist in PostgreSQL (`Settings.printerConfig`) across user sessions.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** with **TypeScript** & **Vite**
- **Tailwind CSS** (Styling & Modern Design System)
- **TanStack React Query** (Data fetching & caching)
- **Web Bluetooth API** (Direct BLE thermal printer communication)
- **Lucide React** (Icons) & **React Hot Toast** (Notifications)

### Backend
- **Node.js** & **Express** with **TypeScript**
- **PostgreSQL** & **Prisma ORM**
- **JSON Web Tokens (JWT)** & **bcrypt** (Authentication & security)
- **Nodemailer** (SMTP OTP verification emails)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Chrome or Edge browser (for Web Bluetooth printing)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rishi048229/Seznik-web.git
   cd inventorymanager
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Backend Setup:**
   ```bash
   cd backend
   npm install
   # Configure your .env file with DATABASE_URL, JWT_SECRET, and SMTP credentials
   npx prisma db push
   npm run dev
   ```

---

## 📜 License
ISC
