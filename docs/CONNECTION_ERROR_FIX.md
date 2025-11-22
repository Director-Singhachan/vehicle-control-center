# 🔧 แก้ไขปัญหา Connection Failed

## สาเหตุของปัญหา "Connection failed"

ปัญหานี้เกิดจากหลายสาเหตุ:

### 1. **ไม่มีไฟล์ `.env.local` หรือตั้งค่าไม่ถูกต้อง** ⚠️ (สาเหตุหลัก)

### 2. **Supabase URL หรือ API Key ไม่ถูกต้อง**

### 3. **ปัญหาการเชื่อมต่ออินเทอร์เน็ตหรือ VPN**

### 4. **Supabase project ถูกปิดหรือหมดอายุ**

---

## ✅ วิธีแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบไฟล์ `.env.local`

1. ตรวจสอบว่ามีไฟล์ `.env.local` ในโฟลเดอร์ root ของโปรเจกต์หรือไม่
   - ไฟล์นี้จะถูก git ignore (ไม่ถูก commit ขึ้น git)

2. ถ้าไม่มี ให้สร้างไฟล์ใหม่ชื่อ `.env.local` ในโฟลเดอร์ root

3. คัดลอกเนื้อหาจาก `env.example` แล้วกรอกข้อมูล:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### ขั้นตอนที่ 2: หา Supabase Credentials

1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. เลือกโปรเจกต์ของคุณ
3. ไปที่ **Settings** → **API**
4. คัดลอก:
   - **Project URL** → ใส่ใน `VITE_SUPABASE_URL`
   - **anon/public key** → ใส่ใน `VITE_SUPABASE_ANON_KEY`

### ขั้นตอนที่ 3: ตรวจสอบการตั้งค่า

ไฟล์ `.env.local` ควรมีลักษณะแบบนี้:

```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzIwMCwiZXhwIjoxOTU0NTQzMjAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **สำคัญ:** 
- อย่าใส่เครื่องหมาย `"` หรือ `'` รอบค่า
- อย่าใส่ช่องว่างก่อนหรือหลัง `=`
- URL ต้องขึ้นต้นด้วย `https://`

### ขั้นตอนที่ 4: Restart Dev Server

หลังจากแก้ไข `.env.local` แล้ว:

1. หยุด dev server (กด `Ctrl+C` ใน terminal)
2. รันใหม่: `npm run dev`

---

## 🔍 ตรวจสอบปัญหาเพิ่มเติม

### ตรวจสอบว่า Environment Variables ถูกโหลดหรือไม่

เปิด Browser Console (F12) และดูว่ามี error เกี่ยวกับ environment variables หรือไม่

### ตรวจสอบ Supabase Project Status

1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. ตรวจสอบว่าโปรเจกต์ยัง **Active** อยู่
3. ตรวจสอบว่า **ไม่เกิน quota** (ถ้าใช้ Free tier)

### ตรวจสอบ Network/VPN

1. ลองปิด VPN แล้วลองใหม่
2. ตรวจสอบ Firewall หรือ Proxy settings
3. ลองเปิดใน Incognito/Private mode

---

## 🛠️ Error Messages ที่ปรับปรุงแล้ว

ระบบได้ปรับปรุง error handling แล้วเพื่อแสดงข้อความที่ชัดเจนขึ้น:

- ✅ แสดงข้อความภาษาไทยที่เข้าใจง่าย
- ✅ แนะนำวิธีแก้ไขปัญหา
- ✅ แสดงปุ่ม "ลองอีกครั้ง" เมื่อเกิด error

---

## 📝 Checklist

- [ ] มีไฟล์ `.env.local` ในโฟลเดอร์ root
- [ ] กรอก `VITE_SUPABASE_URL` ถูกต้อง
- [ ] กรอก `VITE_SUPABASE_ANON_KEY` ถูกต้อง
- [ ] Restart dev server หลังจากแก้ไข `.env.local`
- [ ] ตรวจสอบ Supabase project ยังใช้งานได้
- [ ] ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต

---

## 🆘 ถ้ายังแก้ไม่ได้

1. ตรวจสอบ Browser Console (F12) สำหรับ error messages เพิ่มเติม
2. ตรวจสอบ Network tab ใน DevTools ว่ามี request ไป Supabase หรือไม่
3. ลองสร้าง Supabase project ใหม่และใช้ credentials ใหม่
4. ตรวจสอบว่า Supabase project มี RLS policies ที่ถูกต้อง

---

## 📚 เอกสารเพิ่มเติม

- [QUICK_START.md](../QUICK_START.md) - คู่มือเริ่มต้นใช้งาน
- [ENV_SETUP.md](./ENV_SETUP.md) - คู่มือตั้งค่า Environment Variables
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - คู่มือตั้งค่า Supabase

