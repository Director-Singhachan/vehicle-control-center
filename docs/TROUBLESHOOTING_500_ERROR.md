# 🔧 แก้ไข Error 500: authStore.ts

## 🐛 อาการ

เมื่อรัน `npm run dev` แล้วพบ error:
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
authStore.ts:1   Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

## 🔍 สาเหตุที่เป็นไปได้

1. **Dependencies ไม่ครบ** - `zustand` หรือ `zustand/middleware` ไม่ได้ติดตั้ง
2. **node_modules ไม่สมบูรณ์** - อาจเกิดจากการ copy project โดยไม่ copy `node_modules`
3. **Vite ไม่สามารถ resolve module ได้** - ปัญหาเกี่ยวกับ module resolution
4. **Supabase client ยังไม่พร้อม** - ไฟล์ `authStore.ts` ถูกโหลดก่อนที่ `supabase` client จะพร้อม

## ✅ วิธีแก้ไข

### 1. ติดตั้ง Dependencies ใหม่

```bash
# ลบ node_modules และ package-lock.json (ถ้ามี)
rm -rf node_modules package-lock.json

# ติดตั้ง dependencies ใหม่
npm install
```

### 2. ตรวจสอบว่า zustand ติดตั้งแล้ว

```bash
npm list zustand
```

ควรเห็น:
```
app@0.0.0
└── zustand@5.0.8
```

### 3. ตรวจสอบ .env.local

ตรวจสอบว่ามีไฟล์ `.env.local` และมีค่าถูกต้อง:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. ล้าง Vite Cache

```bash
# ลบ cache ของ Vite
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

### 5. ตรวจสอบ Network/Firewall

- ตรวจสอบว่าไม่มี Firewall หรือ VPN ที่บล็อกการเชื่อมต่อ
- ลองปิด VPN แล้วรันใหม่

### 6. ตรวจสอบ Console Logs

เปิด Browser DevTools (F12) และดู Console tab เพื่อดู error message ที่ละเอียดกว่า

## 🔄 การแก้ไขที่ทำไปแล้ว

1. ✅ เพิ่ม `zustand` และ `zustand/middleware` ใน `optimizeDeps` ของ Vite
2. ✅ เพิ่ม error handling ใน `authStore.ts` เพื่อป้องกัน crash
3. ✅ เพิ่ม try-catch wrapper รอบการ initialize

## 📝 หมายเหตุ

- Error 500 ใน Vite มักหมายถึง server-side error ในการ compile/transpile ไฟล์
- ถ้ายังมีปัญหา ให้ตรวจสอบ terminal ที่รัน `npm run dev` เพื่อดู error message ที่ละเอียดกว่า
- ถ้าปัญหาเกิดเฉพาะที่บ้าน แต่ที่ทำงานใช้ได้ อาจเป็นเพราะ:
  - Dependencies ไม่ครบ (ต้องรัน `npm install`)
  - Network/Firewall issues
  - Node.js version ต่างกัน

## 🆘 ถ้ายังแก้ไม่ได้

1. ตรวจสอบ terminal output จาก `npm run dev` เพื่อดู error message ที่ละเอียด
2. ตรวจสอบ Browser Console (F12) เพื่อดู error message
3. ตรวจสอบว่า Node.js version ตรงกับที่ทำงานหรือไม่:
   ```bash
   node --version
   ```
4. ลองรัน `npm run check` เพื่อตรวจสอบ environment setup

