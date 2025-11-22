# 🔧 แก้ไขปัญหาหน้าเว็บไม่ขึ้น (Blank Page)

## สาเหตุที่เป็นไปได้

### 1. **Supabase Environment Variables ไม่ถูกต้อง** ⚠️ (สาเหตุหลัก)

ถ้าไฟล์ `.env.local` ไม่มีหรือตั้งค่าไม่ถูกต้อง แอปจะไม่สามารถเริ่มต้นได้

**วิธีแก้:**
1. สร้างไฟล์ `.env.local` ในโฟลเดอร์ root
2. กรอกข้อมูล:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
3. Restart dev server

### 2. **JavaScript Error ใน Browser Console**

เปิด Browser Console (F12) และดูว่ามี error อะไร

**วิธีแก้:**
- ดู error message ใน Console
- ตรวจสอบ Network tab ว่ามี request ที่ fail หรือไม่

### 3. **Port ถูกใช้งานอยู่แล้ว**

ถ้า port 3000 ถูกใช้งานอยู่ Vite อาจจะใช้ port อื่น

**วิธีแก้:**
- ดูใน terminal ว่า Vite รันที่ port ไหน
- เปิด URL ที่ถูกต้อง (อาจจะเป็น `http://localhost:3001` แทน `3000`)

### 4. **ไฟล์ CSS ไม่ถูกโหลด**

ถ้า `src/index.css` ไม่ถูกโหลด Tailwind จะไม่ทำงาน

**วิธีแก้:**
- ตรวจสอบว่าไฟล์ `src/index.css` มีอยู่
- ตรวจสอบว่า import ใน `index.tsx` ถูกต้อง

---

## 🔍 วิธีตรวจสอบปัญหา

### ขั้นตอนที่ 1: ตรวจสอบ Dev Server

1. ดูใน terminal ว่า Vite รันสำเร็จหรือไม่
2. ดู URL ที่แสดง (ควรเป็น `http://localhost:3000` หรือ `http://localhost:XXXX`)
3. ตรวจสอบว่ามี error message หรือไม่

### ขั้นตอนที่ 2: ตรวจสอบ Browser Console

1. เปิด Browser (Chrome/Firefox/Edge)
2. กด F12 เพื่อเปิด DevTools
3. ไปที่แท็บ **Console**
4. ดูว่ามี error message อะไร (สีแดง)
5. ไปที่แท็บ **Network** ดูว่ามี request ที่ fail หรือไม่

### ขั้นตอนที่ 3: ตรวจสอบ Environment Variables

1. ตรวจสอบว่ามีไฟล์ `.env.local` หรือไม่
2. ตรวจสอบว่า URL และ Key ถูกต้อง
3. ตรวจสอบว่าไม่มีเครื่องหมาย `"` หรือ `'` รอบค่า

### ขั้นตอนที่ 4: ตรวจสอบไฟล์หลัก

1. ตรวจสอบว่า `index.html` มีอยู่
2. ตรวจสอบว่า `index.tsx` มีอยู่
3. ตรวจสอบว่า `src/index.css` มีอยู่

---

## 🛠️ วิธีแก้ไขแบบ Step-by-Step

### Solution 1: ตรวจสอบและแก้ไข Environment Variables

```bash
# 1. ตรวจสอบว่ามีไฟล์ .env.local หรือไม่
ls .env.local

# 2. ถ้าไม่มี ให้สร้างจาก env.example
cp env.example .env.local

# 3. แก้ไขไฟล์ .env.local และกรอก Supabase credentials
# 4. Restart dev server
npm run dev
```

### Solution 2: Clear Cache และ Reinstall

```bash
# 1. ลบ node_modules และ package-lock.json
rm -rf node_modules package-lock.json

# 2. ติดตั้งใหม่
npm install

# 3. รัน dev server
npm run dev
```

### Solution 3: ตรวจสอบ Browser Console

1. เปิด Browser
2. กด F12
3. ไปที่ Console tab
4. Copy error message ทั้งหมด
5. ตรวจสอบ error message เพื่อหาสาเหตุ

---

## 📋 Checklist

- [ ] Dev server รันอยู่ (ดูใน terminal)
- [ ] เปิด URL ที่ถูกต้อง (ดูใน terminal)
- [ ] มีไฟล์ `.env.local` และตั้งค่าถูกต้อง
- [ ] Browser Console ไม่มี error (F12)
- [ ] Network tab ไม่มี request ที่ fail
- [ ] ไฟล์ `index.html`, `index.tsx`, `src/index.css` มีอยู่

---

## 🆘 ถ้ายังแก้ไม่ได้

1. **ดู Browser Console (F12)** - มี error message อะไรบ้าง?
2. **ดู Terminal** - Vite แสดง error อะไรบ้าง?
3. **ตรวจสอบ Network tab** - มี request ไหน fail บ้าง?
4. **ลองเปิดใน Incognito/Private mode** - อาจเป็นปัญหา cache
5. **ลองใช้ browser อื่น** - อาจเป็นปัญหา browser-specific

---

## 📚 เอกสารเพิ่มเติม

- [CONNECTION_ERROR_FIX.md](./CONNECTION_ERROR_FIX.md) - แก้ไขปัญหา Connection Failed
- [ENV_SETUP.md](./ENV_SETUP.md) - คู่มือตั้งค่า Environment Variables
- [QUICK_START.md](../QUICK_START.md) - คู่มือเริ่มต้นใช้งาน

