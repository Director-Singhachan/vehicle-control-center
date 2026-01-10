

# 🚗 Vehicle Control Center

ระบบจัดการรถยนต์และจัดส่งสินค้าครบวงจร สำหรับจัดการยานพาหนะ ออเดอร์ การจัดส่ง คลังสินค้า และค่าคอมมิชชั่น

## ✨ Features

### 🚛 จัดการยานพาหนะและทริป
- จัดการข้อมูลรถยนต์ (เพิ่ม/แก้ไข/ลบ)
- บันทึกการใช้งานรถ (Trip Logs)
- บันทึกการเติมน้ำมัน (Fuel Logs)
- แจ้งซ่อมบำรุงรักษา (Maintenance Tickets)
- ติดตามสถานะรถแบบ Real-time

### 📦 ระบบออเดอร์และจัดส่ง
- รับออเดอร์จากลูกค้า
- จัดคิวส่งสินค้า
- สร้าง Delivery Trips
- จัดการพนักงานส่งสินค้า (Crew Management)
- ติดตามสถานะการส่งสินค้า

### 🏭 ระบบคลังสินค้า
- จัดการคลังสินค้า (Warehouses)
- จัดการสินค้า (Products)
- จัดการสต็อก (Inventory)
- ประวัติรับสินค้า (Inventory Receipts)
- แดชบอร์ดสต็อกสินค้า

### 💰 ระบบค่าคอมมิชชั่น
- คำนวณค่าคอมมิชชั่นอัตโนมัติ
- จัดการอัตราค่าคอม (Commission Rates)
- ประวัติการคำนวณค่าคอม
- รายงานค่าคอมมิชชั่น

### 👥 จัดการลูกค้าและราคา
- จัดการข้อมูลร้านค้า/ลูกค้า (Stores)
- ระดับลูกค้า (Customer Tiers)
- ราคาสินค้าตามระดับลูกค้า (Tier Pricing)

### 📊 รายงานและสถิติ
- Dashboard สรุปภาพรวม
- รายงานการใช้รถ
- สถิติการส่งสินค้า
- สถิติค่าคอมมิชชั่น

### 🔔 การแจ้งเตือน
- แจ้งเตือนผ่าน LINE
- แจ้งเตือนผ่าน Telegram
- สรุปการใช้งานรายวัน (Daily Summary)

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage)
- **State Management**: Zustand
- **Charts**: Chart.js + react-chartjs-2
- **Icons**: Lucide React
- **Build Tool**: Vite 6
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ และ npm/yarn
- Supabase account
- (Optional) Supabase CLI สำหรับ deploy Edge Functions

### Installation

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd vehicle-control-center
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup Environment Variables:**
   - คัดลอก `.env.example` เป็น `.env.local`
   - เพิ่ม Supabase credentials:
     ```env
     VITE_SUPABASE_URL=https://your-project-id.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - ดูคู่มือ: [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md)

4. **Setup Supabase Database:**
   - สร้าง Supabase project (ถ้ายังไม่มี)
   - รัน SQL migrations ตาม [`docs/SQL_MIGRATION_GUIDE.md`](./docs/SQL_MIGRATION_GUIDE.md)

5. **Deploy Edge Functions (Optional):**
   ```bash
   supabase functions deploy auto-commission-worker
   supabase functions deploy notification-worker
   supabase functions deploy daily-summary-worker
   ```
   - ดูคู่มือ: [`docs/CLI_DEPLOY_DETAILED.md`](./docs/CLI_DEPLOY_DETAILED.md)

6. **Run the app:**
   ```bash
   npm run dev
   ```

7. **Build for production:**
   ```bash
   npm run build
   ```

## 📚 Documentation

### คู่มือเริ่มต้นใช้งาน
- [`QUICK_START.md`](./QUICK_START.md) - คู่มือเริ่มต้นใช้งานแบบละเอียด
- [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md) - คู่มือตั้งค่า Environment Variables
- [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) - คู่มือตั้งค่า Supabase

### Database & Migrations
- [`docs/SQL_MIGRATION_GUIDE.md`](./docs/SQL_MIGRATION_GUIDE.md) - คู่มือรัน SQL Migrations
- [`sql/README.md`](./sql/README.md) - เอกสาร SQL Migrations

### Deployment
- [`docs/VERCEL_DEPLOYMENT.md`](./docs/VERCEL_DEPLOYMENT.md) - คู่มือ Deploy บน Vercel
- [`docs/CLI_DEPLOY_DETAILED.md`](./docs/CLI_DEPLOY_DETAILED.md) - คู่มือ Deploy Edge Functions

### Features & Workflows
- [`docs/FINAL_ARCHITECTURE.md`](./docs/FINAL_ARCHITECTURE.md) - สถาปัตยกรรมระบบ
- [`docs/SALES_TEAM_WORKFLOW.md`](./docs/SALES_TEAM_WORKFLOW.md) - Workflow ฝ่ายขาย
- [`docs/CORRECT_WORKFLOW.md`](./docs/CORRECT_WORKFLOW.md) - Workflow การทำงาน

### Notifications
- [`docs/TELEGRAM_WEBHOOK_SETUP.md`](./docs/TELEGRAM_WEBHOOK_SETUP.md) - ตั้งค่า Telegram Webhook
- [`docs/LINE_PDF_APPROVAL_SETUP.md`](./docs/LINE_PDF_APPROVAL_SETUP.md) - ตั้งค่า LINE Webhook
- [`docs/DAILY_SUMMARY_SETUP.md`](./docs/DAILY_SUMMARY_SETUP.md) - ตั้งค่าสรุปรายวัน

### Mobile App
- [`docs/MOBILE_APP_ARCHITECTURE.md`](./docs/MOBILE_APP_ARCHITECTURE.md) - สถาปัตยกรรม Mobile App
- [`FLUTTER_QUICK_START.md`](./FLUTTER_QUICK_START.md) - คู่มือเริ่มต้น Mobile App

### Troubleshooting
- [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) - แก้ไขปัญหาทั่วไป
- [`docs/CONNECTION_ERROR_FIX.md`](./docs/CONNECTION_ERROR_FIX.md) - แก้ไขปัญหาเชื่อมต่อ

## 📂 Project Structure

```
vehicle-control-center/
├── components/          # React components
├── views/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API services
├── stores/             # Zustand stores
├── types/              # TypeScript types
├── supabase/
│   ├── functions/      # Edge Functions
│   └── migrations/     # Database migrations
├── sql/                # SQL scripts
└── docs/               # Documentation
```

## 🔐 Security

- Row Level Security (RLS) enabled สำหรับทุก tables
- Role-based access control (Admin, Manager, Sales, Driver, etc.)
- Secure Edge Functions สำหรับ operations ที่ต้อง bypass RLS

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

[Your License Here]

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Backend-as-a-Service
- [Vercel](https://vercel.com) - Deployment Platform
- [React](https://react.dev) - UI Library
