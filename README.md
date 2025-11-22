<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/10OwL4E7RHmWA_ifUDHnHXowEes1Zp8bO

## Run Locally

**Prerequisites:**  Node.js และ Supabase account

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup Environment Variables:**
   - สร้างไฟล์ `.env.local` ใน root directory
   - เพิ่ม Supabase credentials:
     ```env
     VITE_SUPABASE_URL=https://your-project-id.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - ดูคู่มือ: [`QUICK_START.md`](./QUICK_START.md) หรือ [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md)

3. **Setup Supabase Database:**
   - สร้าง Supabase project (ถ้ายังไม่มี)
   - รัน SQL migrations ตาม [`docs/SQL_MIGRATION_GUIDE.md`](./docs/SQL_MIGRATION_GUIDE.md)

4. **Run the app:**
   ```bash
   npm run dev
   ```

### 📚 Documentation

- [`QUICK_START.md`](./QUICK_START.md) - คู่มือเริ่มต้นใช้งาน
- [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md) - คู่มือตั้งค่า Environment Variables
- [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) - คู่มือตั้งค่า Supabase
- [`docs/SQL_MIGRATION_GUIDE.md`](./docs/SQL_MIGRATION_GUIDE.md) - คู่มือรัน SQL Migrations
- [`docs/DEVELOPMENT_ROADMAP.md`](./docs/DEVELOPMENT_ROADMAP.md) - แผนการพัฒนา
