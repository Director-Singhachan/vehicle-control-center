# 🚨 แก้ไขด่วน: หน้าเว็บไม่ขึ้น

## ขั้นตอนที่ 1: ตรวจสอบ Browser Console

1. เปิด Browser (Chrome/Firefox/Edge)
2. กด **F12** เพื่อเปิด DevTools
3. ไปที่แท็บ **Console**
4. ดู error message (สีแดง)
5. **Copy error message ทั้งหมด** มาให้ดู

## ขั้นตอนที่ 2: ตรวจสอบ Terminal

ดูใน Terminal ที่รัน `npm run dev` ว่ามี error อะไรหรือไม่

## ขั้นตอนที่ 3: ตรวจสอบ Environment Variables

รันคำสั่งนี้:
```bash
npm run check
```

หรือตรวจสอบด้วยตนเอง:
1. ตรวจสอบว่ามีไฟล์ `.env.local` ในโฟลเดอร์ root
2. ตรวจสอบว่าไฟล์มีเนื้อหาประมาณนี้:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## ขั้นตอนที่ 4: Restart Dev Server

1. หยุด dev server (กด `Ctrl+C` ใน terminal)
2. รันใหม่: `npm run dev`
3. ดู URL ที่แสดง (ควรเป็น `http://localhost:3000` หรือ `http://localhost:XXXX`)

## ขั้นตอนที่ 5: Clear Browser Cache

1. ลองเปิดใน **Incognito/Private mode**
2. หรือ Clear cache (Ctrl+Shift+Delete)

---

## 🆘 ถ้ายังแก้ไม่ได้

**กรุณาแจ้ง:**
1. Error message จาก Browser Console (F12 → Console tab)
2. Error message จาก Terminal (ถ้ามี)
3. URL ที่ Vite แสดงใน Terminal
4. ว่าหน้าเว็บแสดงอะไร (blank, error message, loading forever)

---

## 📋 Checklist

- [ ] Dev server รันอยู่ (ดูใน terminal)
- [ ] เปิด URL ที่ถูกต้อง (ดูใน terminal)
- [ ] Browser Console ไม่มี error (F12)
- [ ] มีไฟล์ `.env.local` และตั้งค่าถูกต้อง
- [ ] Restart dev server แล้ว

