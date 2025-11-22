# คู่มือการตั้งค่า Supabase

## 📝 การตั้งชื่อโปรเจกต์ใน Supabase

### ชื่อที่แนะนำ

สำหรับโปรเจกต์ **Vehicle Control Center** แนะนำชื่อดังนี้:

#### ตัวเลือกที่ 1: ใช้ชื่อเต็ม (แนะนำ)
```
vehicle-control-center
```
- ✅ อธิบายได้ชัดเจนว่าเป็นระบบอะไร
- ✅ ใช้ kebab-case (มาตรฐาน)
- ✅ ไม่มีตัวพิมพ์ใหญ่หรืออักขระพิเศษ

#### ตัวเลือกที่ 2: ใช้ชื่อย่อ
```
vcc
```
- ✅ สั้น จำง่าย
- ⚠️ อาจไม่ชัดเจนถ้ามีหลายโปรเจกต์

#### ตัวเลือกที่ 3: ใช้ชื่อภาษาไทย (ถ้าต้องการ)
```
vehicle-control-center-th
```
- ✅ ระบุว่าเป็นเวอร์ชันไทย
- ⚠️ URL จะยาวขึ้น

#### ตัวเลือกที่ 4: เพิ่ม environment
```
vehicle-control-center-dev
vehicle-control-center-prod
vehicle-control-center-staging
```
- ✅ แยก environment ชัดเจน
- ✅ ใช้ได้หลาย environment

---

## 🎯 วิธีตั้งชื่อโปรเจกต์ใน Supabase

### ขั้นตอนที่ 1: สร้างโปรเจกต์ใหม่
1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. คลิก **"New Project"**
3. กรอกข้อมูล:
   - **Name**: `vehicle-control-center` (หรือชื่อที่เลือก)
   - **Database Password**: ตั้งรหัสผ่านที่แข็งแรง (บันทึกไว้!)
   - **Region**: เลือก region ที่ใกล้ที่สุด (แนะนำ: `Southeast Asia (Singapore)`)
   - **Pricing Plan**: เลือกตามความต้องการ

### ขั้นตอนที่ 2: ตั้งค่า Project Settings
1. ไปที่ **Settings** → **General**
2. ตรวจสอบ **Project Name** และ **Reference ID**
3. **Reference ID** จะถูกใช้ใน URL:
   ```
   https://[reference-id].supabase.co
```

---

## 📋 Checklist การตั้งค่า

### ✅ หลังสร้างโปรเจกต์
- [ ] บันทึก **Project URL** และ **API Keys**
- [ ] ตั้งรหัสผ่าน Database (บันทึกไว้!)
- [ ] ตั้งค่า Region (แนะนำ: Southeast Asia)
- [ ] ตรวจสอบ Reference ID

### ✅ หลังรัน Migrations
- [ ] ตรวจสอบ Tables ถูกสร้างครบ
- [ ] ตรวจสอบ Views ถูกสร้างครบ
- [ ] ตรวจสอบ Functions ถูกสร้างครบ
- [ ] ทดสอบ RLS Policies

### ✅ ตั้งค่า Environment Variables
- [ ] สร้างไฟล์ `.env.local`
- [ ] ใส่ `VITE_SUPABASE_URL`
- [ ] ใส่ `VITE_SUPABASE_ANON_KEY`
- [ ] ตรวจสอบว่า `.env.local` อยู่ใน `.gitignore`

---

## 🔑 API Keys และ URLs

### วิธีหา API Keys
1. ไปที่ **Settings** → **API**
2. คัดลอก:
   - **Project URL**: `https://[your-project-ref].supabase.co`
   - **anon/public key**: ใช้ใน frontend
   - **service_role key**: ใช้ใน server-side เท่านั้น (อย่า expose!)

### ตัวอย่าง `.env.local`
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ⚠️ อย่าใส่ service_role key ใน frontend!
```

---

## 🌍 Region Selection

### Regions ที่แนะนำสำหรับประเทศไทย
1. **Southeast Asia (Singapore)** ⭐ (แนะนำที่สุด)
   - Latency ต่ำสุดสำหรับผู้ใช้ในไทย
   - ระยะทางใกล้ที่สุด

2. **Southeast Asia (Mumbai)**
   - ทางเลือกที่ 2

3. **US Regions**
   - ใช้ถ้าต้องการ compliance หรือ features เฉพาะ

### หมายเหตุ
- **ไม่สามารถเปลี่ยน region หลังสร้างโปรเจกต์แล้ว**
- เลือก region ให้เหมาะสมตั้งแต่แรก

---

## 🔒 Security Best Practices

### 1. API Keys
- ✅ ใช้ **anon key** ใน frontend
- ❌ **อย่า** expose service_role key
- ✅ เก็บ keys ใน `.env.local` (ไม่ commit)

### 2. Database Password
- ✅ ใช้รหัสผ่านที่แข็งแรง (12+ characters)
- ✅ บันทึกไว้ใน password manager
- ❌ อย่าใช้รหัสผ่านเดิมซ้ำ

### 3. RLS Policies
- ✅ เปิด RLS ทุก table
- ✅ ทดสอบ policies หลังสร้าง
- ✅ ตรวจสอบ permissions ตาม roles

---

## 📊 Project Limits (Free Tier)

### Supabase Free Tier
- **Database Size**: 500 MB
- **Bandwidth**: 5 GB/month
- **API Requests**: 50,000/month
- **File Storage**: 1 GB
- **Auth Users**: Unlimited

### เมื่อไหร่ควร Upgrade
- Database ใกล้เต็ม 500 MB
- Bandwidth เกิน 5 GB/เดือน
- ต้องการ features เพิ่มเติม (backups, support)

---

## 🚀 Next Steps

1. **รัน Migrations**
   - ดู `docs/SQL_MIGRATION_GUIDE.md`

2. **Setup Frontend**
   - ดู `docs/DEVELOPMENT_ROADMAP.md`

3. **ทดสอบ Connection**
   ```typescript
   import { supabase } from './lib/supabase';
   
   const test = async () => {
     const { data, error } = await supabase
       .from('vehicles')
       .select('count');
     console.log('Connection:', error ? 'Failed' : 'Success');
   };
   ```

---

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Dashboard](https://app.supabase.com)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Regions](https://supabase.com/docs/guides/platform/regions)

---

## ❓ FAQ

### Q: เปลี่ยนชื่อโปรเจกต์ได้ไหม?
**A:** เปลี่ยนได้ที่ Settings → General → Project Name (แต่ Reference ID เปลี่ยนไม่ได้)

### Q: Reference ID คืออะไร?
**A:** เป็น unique identifier ที่ใช้ใน URL (เช่น `abc123xyz`) ไม่สามารถเปลี่ยนได้

### Q: ใช้ชื่อภาษาไทยได้ไหม?
**A:** ได้ แต่แนะนำให้ใช้ภาษาอังกฤษเพื่อความเข้ากันได้กับระบบต่างๆ

### Q: สร้างหลายโปรเจกต์ได้ไหม?
**A:** ได้ (Free tier จำกัดจำนวน) แนะนำให้แยก dev/staging/prod

