h
# 🚀 Vercel Deployment Guide

## ⚠️ ปัญหาที่พบบ่อย: หน้ายานพาหนะไม่แสดงข้อมูลใน Production

### สาเหตุหลัก:
1. **Environment Variables ไม่ถูกตั้งค่าใน Vercel**
2. **RLS (Row Level Security) Policies ทำงานต่างกัน**
3. **Error handling ที่ทำให้หน้าไม่แสดงผล**

---

## 📋 ขั้นตอนการแก้ไข

### 1. ตั้งค่า Environment Variables ใน Vercel

1. ไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
2. เลือกโปรเจกต์ของคุณ
3. ไปที่ **Settings** → **Environment Variables**
4. เพิ่มตัวแปรต่อไปนี้:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**สำคัญ:**
- ใช้ค่าเดียวกับที่ใช้ใน `.env.local` (local development)
- ตรวจสอบว่า URL และ Key ถูกต้อง
- หลังจากเพิ่มแล้ว ต้อง **Redeploy** เพื่อให้ตัวแปรมีผล

### 2. ตรวจสอบ Environment Variables

หลังจาก deploy แล้ว เปิด Browser Console (F12) และดู logs:

```
[Supabase Config] URL: https://oqacrkcfpdhcntbldgrm.s...
[Supabase Config] Key: eyJhbGciOiJIUzI1NiIs...
```

**ถ้าเห็น:**
- `❌ NOT SET` → Environment variables ไม่ถูกตั้งค่า
- `https://placeholder.supabase.co` → ใช้ค่า placeholder (ไม่ถูกต้อง)

### 3. ตรวจสอบ RLS Policies

ใน Supabase Dashboard → **Authentication** → **Policies**:

ตรวจสอบว่า:
- ✅ `vehicles` table มี policy สำหรับ `SELECT` ที่อนุญาตให้ authenticated users อ่านได้
- ✅ `vehicles_with_status` view มี policy ที่ถูกต้อง (ถ้าใช้)

**ตัวอย่าง Policy สำหรับ vehicles:**
```sql
-- Allow authenticated users to read vehicles
CREATE POLICY "Allow authenticated users to read vehicles"
ON vehicles FOR SELECT
TO authenticated
USING (true);
```

### 4. ตรวจสอบ Console Logs

เปิด Browser Console (F12) และดู logs:

**Logs ที่ควรเห็น:**
```
[VehiclesView] Component rendered
[VehiclesView] Initial render: {vehiclesCount: 38, loading: false, ...}
[vehicleService] getAll: Success, count: 38
```

**Logs ที่บ่งชี้ปัญหา:**
```
[vehicleService] getAll: Error: ...
[vehicleService] getSession timeout after 5s
Session error: Session check timeout
```

### 5. ตรวจสอบ Network Tab

เปิด Browser DevTools → **Network** tab:

1. Filter: `XHR` หรือ `Fetch`
2. ดู requests ไปที่ Supabase
3. ตรวจสอบ:
   - **Status Code**: ควรเป็น `200` (ไม่ใช่ `401`, `403`, `500`)
   - **Response**: ควรมีข้อมูล vehicles

**ถ้าเห็น:**
- `401 Unauthorized` → Session/authentication problem
- `403 Forbidden` → RLS policy problem
- `500 Internal Server Error` → Database/query problem

---

## 🔧 การแก้ไขปัญหาเฉพาะ

### ปัญหา: ข้อมูลไม่แสดง แต่ไม่มี error

**สาเหตุ:** Error handling ที่ซ่อน error หรือ loading state ที่ไม่สิ้นสุด

**แก้ไข:**
- ตรวจสอบ console logs
- ตรวจสอบว่า `loading` state เป็น `false` หรือไม่
- ตรวจสอบว่า `vehicles` array มีข้อมูลหรือไม่

### ปัญหา: Session timeout

**สาเหตุ:** Network latency หรือ Supabase connection issues

**แก้ไข:**
- ตรวจสอบ internet connection
- ตรวจสอบ Supabase project status
- ลอง refresh หน้าเว็บ

### ปัญหา: Environment variables ไม่ทำงาน

**สาเหตุ:** Vercel cache หรือไม่ได้ redeploy

**แก้ไข:**
1. ตรวจสอบว่า environment variables ถูกตั้งค่าใน Vercel
2. **Redeploy** โปรเจกต์ (Settings → Deployments → Redeploy)
3. Clear browser cache และ hard refresh (Ctrl+Shift+R)

---

## ✅ Checklist ก่อน Deploy

- [ ] Environment variables ถูกตั้งค่าใน Vercel
- [ ] RLS policies ถูกตั้งค่าอย่างถูกต้อง
- [ ] ทดสอบใน local (`npm run dev`) ทำงานปกติ
- [ ] ไม่มี console errors ใน local
- [ ] Supabase project ทำงานปกติ

---

## 🆘 ถ้ายังมีปัญหา

1. **ตรวจสอบ Vercel Logs:**
   - ไปที่ Vercel Dashboard → **Deployments** → เลือก deployment → **Functions** tab
   - ดู error logs

2. **ตรวจสอบ Supabase Logs:**
   - ไปที่ Supabase Dashboard → **Logs** → **API Logs**
   - ดู requests และ errors

3. **ทดสอบ Supabase Connection:**
   - เปิด Browser Console
   - รัน: `window.supabase.from('vehicles').select('*').then(console.log)`
   - ดูว่ามี error หรือไม่

4. **ติดต่อ Support:**
   - ส่ง console logs
   - ส่ง network requests
   - ส่ง Vercel deployment logs

---

## 📝 หมายเหตุ

- Environment variables ใน Vercel จะถูก inject ใน build time
- ต้อง redeploy หลังจากเปลี่ยน environment variables
- Vercel จะ cache build ถ้า code ไม่เปลี่ยน → ต้อง force redeploy

