# 🚀 Quick Start Guide

## ⚠️ สำคัญ: ตั้งค่า Environment Variables ก่อนใช้งาน

### ขั้นตอนที่ 1: สร้างไฟล์ .env.local

สร้างไฟล์ `.env.local` ในโฟลเดอร์โปรเจกต์ (root directory) ด้วยเนื้อหานี้:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### ขั้นตอนที่ 2: หา Supabase Credentials

1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. สร้างโปรเจกต์ใหม่ (ถ้ายังไม่มี) หรือเลือกโปรเจกต์ที่มีอยู่
3. ไปที่ **Settings** → **API**
4. คัดลอก:
   - **Project URL** → ใส่ใน `VITE_SUPABASE_URL`
   - **anon/public key** → ใส่ใน `VITE_SUPABASE_ANON_KEY`

### ขั้นตอนที่ 3: Restart Dev Server

หลังจากสร้างไฟล์ `.env.local` แล้ว:

```bash
# หยุด server (Ctrl+C)
# แล้วรันใหม่
npm run dev
```

### ขั้นตอนที่ 4: รัน SQL Migrations

1. ไปที่ Supabase Dashboard → **SQL Editor**
2. รัน SQL migrations ตามลำดับ (ดู `docs/SQL_MIGRATION_GUIDE.md`)
3. เริ่มจาก `sql/20251105120000_initial_schema.sql`

---

## ✅ ตรวจสอบว่าทำถูกต้อง

หลังจาก restart server แล้ว:
- ✅ ไม่มี error "Missing Supabase environment variables"
- ✅ ไม่มี error "supabaseUrl is required"
- ✅ Console ไม่มี warning เรื่อง Supabase

---

## 🆘 ถ้ายังมีปัญหา

1. **ตรวจสอบไฟล์ .env.local:**
   - ต้องอยู่ใน root directory (เดียวกับ package.json)
   - ชื่อไฟล์ต้องเป็น `.env.local` (มีจุดหน้าชื่อ)
   - ต้องไม่มี space หรือ newline ใน URL และ Key

2. **ตรวจสอบว่า Restart Server แล้ว:**
   - Vite จะโหลด .env.local เมื่อ start เท่านั้น
   - ต้อง restart ทุกครั้งที่แก้ไข .env.local

3. **ตรวจสอบ Format:**
   ```env
   # ✅ ถูกต้อง
   VITE_SUPABASE_URL=https://abc123.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   # ❌ ผิด - มี space
   VITE_SUPABASE_URL = https://abc123.supabase.co
   
   # ❌ ผิด - ไม่มี VITE_ prefix
   SUPABASE_URL=https://abc123.supabase.co
   ```

---

## 📚 เอกสารเพิ่มเติม

- `docs/ENV_SETUP.md` - คู่มือการตั้งค่า environment variables แบบละเอียด
- `docs/SUPABASE_SETUP.md` - คู่มือการตั้งค่า Supabase
- `docs/SQL_MIGRATION_GUIDE.md` - คู่มือการรัน SQL migrations

