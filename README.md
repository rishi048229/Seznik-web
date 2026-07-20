# Seznik Web - Inventory Manager

A full-stack Inventory Management System built to efficiently track and manage inventory, featuring a modern, responsive web interface and a robust backend API.

## Features
- **User Authentication:** Secure login and registration using JWT and bcrypt.
- **Inventory Tracking:** Manage products, stock levels, and item details.
- **Dashboard & Analytics:** Visual insights and reporting using Recharts.
- **Form Validation:** Client-side and server-side validation using Zod and React Hook Form.
- **Image Handling:** Image compression and processing for inventory items.
- **Modern UI:** Built with React 19, Tailwind CSS, and Lucide React icons for a beautiful user experience.

## Tech Stack

### Frontend
- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS** (Styling)
- **React Router** (Routing)
- **React Hook Form & Zod** (Form handling and validation)
- **React Query** (Data fetching and state management)
- **Recharts** (Data visualization)
- **Lucide React** (Icons)

### Backend
- **Node.js & Express**
- **TypeScript**
- **Prisma** (ORM)
- **JSON Web Tokens (JWT)** (Authentication)
- **bcrypt/bcryptjs** (Password hashing)

## Getting Started

### Prerequisites
- Node.js (v18+)
- Package manager (npm, yarn, or pnpm)
- Database supported by Prisma (e.g., PostgreSQL, MySQL)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rishi048229/Seznik-web.git
   cd Seznik-web
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
   # Set up your .env file with database credentials
   npx prisma generate
   npx prisma migrate dev
   npm run dev
   ```

## License
ISC
