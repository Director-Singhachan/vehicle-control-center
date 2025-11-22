# 🔍 วิธีหาไฟล์ .env.local

## ⚠️ ไฟล์ .env.local เป็นไฟล์ซ่อน (Hidden File)

ไฟล์ `.env.local` มีอยู่แล้วในโปรเจกต์ แต่เป็นไฟล์ซ่อน (ขึ้นต้นด้วยจุด) ทำให้บาง IDE หรือ File Explorer อาจไม่แสดง

## 📁 วิธีหาไฟล์ .env.local

### วิธีที่ 1: ใช้ VS Code / Cursor
1. เปิด VS Code หรือ Cursor
2. กด `Ctrl + Shift + P` (หรือ `Cmd + Shift + P` บน Mac)
3. พิมพ์ "Show All Files" หรือ "Files: Toggle Excluded Files"
4. ไฟล์ `.env.local` จะแสดงขึ้นมา

### วิธีที่ 2: ใช้ File Explorer (Windows)
1. เปิด File Explorer
2. ไปที่โฟลเดอร์โปรเจกต์
3. คลิกแท็บ **View**
4. ติ๊ก **Hidden items** (แสดงไฟล์ซ่อน)
5. ไฟล์ `.env.local` จะแสดงขึ้นมา

### วิธีที่ 3: ใช้ Terminal
```powershell
# ดูไฟล์ทั้งหมดรวมไฟล์ซ่อน
Get-ChildItem -Force | Where-Object { $_.Name -like ".env*" }

# หรือเปิดไฟล์ด้วย notepad
notepad .env.local
```

### วิธีที่ 4: สร้างไฟล์ใหม่
ถ้ายังหาไม่เจอ ให้สร้างไฟล์ใหม่:

1. **ใน VS Code / Cursor:**
   - คลิกขวาที่โฟลเดอร์ root
   - เลือก "New File"
   - พิมพ์ชื่อ: `.env.local` (มีจุดหน้าชื่อ)

2. **ใน File Explorer:**
   - เปิด Notepad
   - พิมพ์เนื้อหาจาก `env.example`
   - Save As → ชื่อไฟล์: `.env.local` (ใส่จุดหน้าชื่อ)
   - เปลี่ยน "Save as type" เป็น "All Files (*.*)"

3. **ใช้ Terminal:**
   ```powershell
   # คัดลอกจาก env.example
   Copy-Item env.example .env.local
   ```

## 📝 เนื้อหาที่ต้องใส่ใน .env.local

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**สำคัญ:** ต้องแก้ไขเป็นข้อมูลจริงจาก Supabase Dashboard

## ✅ ตรวจสอบว่าไฟล์ถูกต้อง

หลังจากสร้างไฟล์แล้ว:

1. **ตรวจสอบว่าไฟล์อยู่ใน root directory:**
   - ต้องอยู่ในโฟลเดอร์เดียวกับ `package.json`
   - ไม่ใช่ใน `src/` หรือโฟลเดอร์อื่น

2. **ตรวจสอบชื่อไฟล์:**
   - ต้องเป็น `.env.local` (มีจุดหน้าชื่อ)
   - ไม่ใช่ `env.local` หรือ `.env.local.txt`

3. **ตรวจสอบเนื้อหา:**
   - ต้องมี `VITE_SUPABASE_URL=`
   - ต้องมี `VITE_SUPABASE_ANON_KEY=`
   - ไม่มี space รอบเครื่องหมาย `=`

## 🆘 ถ้ายังหาไม่เจอ

ลองใช้คำสั่งนี้ใน Terminal:

```powershell
# ดูไฟล์ทั้งหมด
Get-ChildItem -Force

# หรือดูเฉพาะไฟล์ .env
Get-ChildItem -Force -Filter ".env*"

# สร้างไฟล์ใหม่
notepad .env.local
```

## 📍 ตำแหน่งไฟล์

ไฟล์ `.env.local` ต้องอยู่ใน:
```
vehicle-control-center/
├── .env.local          ← ต้องอยู่ที่นี่
├── package.json
├── index.html
├── vite.config.ts
└── ...
```

---

**หมายเหตุ:** ไฟล์ `.env` (ไม่มี .local) ก็สร้างให้แล้วเช่นกัน แต่แนะนำให้ใช้ `.env.local` เพราะจะไม่ถูก commit ขึ้น Git

