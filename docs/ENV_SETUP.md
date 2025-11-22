# การตั้งค่า Environment Variables

## 📝 ไฟล์ .env.local

ไฟล์ `.env.local` ถูกสร้างแล้ว! ตอนนี้คุณต้องกรอกข้อมูล Supabase credentials

## 🔑 วิธีหา Supabase Credentials

### 1. ไปที่ Supabase Dashboard
1. เปิด [Supabase Dashboard](https://app.supabase.com)
2. เลือกโปรเจกต์ของคุณ (หรือสร้างใหม่ถ้ายังไม่มี)
3. ไปที่ **Settings** → **API**

### 2. คัดลอกข้อมูล
คุณจะเห็น:
- **Project URL** - คัดลอก URL นี้
- **anon/public key** - คัดลอก key นี้

### 3. แก้ไขไฟล์ .env.local

เปิดไฟล์ `.env.local` และแก้ไข:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**ตัวอย่าง:**
```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI4MCwiZXhwIjoxOTU0NTQzMjgwfQ.example
```

## ⚠️ ข้อควรระวัง

1. **อย่า commit .env.local**
   - ไฟล์นี้อยู่ใน `.gitignore` แล้ว
   - อย่า push ขึ้น Git repository

2. **ใช้ anon key เท่านั้น**
   - ใช้ `VITE_SUPABASE_ANON_KEY` ใน frontend
   - **อย่า** ใช้ `SUPABASE_SERVICE_ROLE_KEY` ใน frontend (ไม่ปลอดภัย)

3. **ตรวจสอบว่า URL และ Key ถูกต้อง**
   - URL ต้องเป็น `https://[project-id].supabase.co`
   - Key ต้องเป็น anon/public key (ไม่ใช่ service_role key)

## ✅ ตรวจสอบการตั้งค่า

หลังจากกรอกข้อมูลแล้ว:

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **ตรวจสอบ console:**
   - ควรไม่มี warning เรื่อง "Missing Supabase environment variables"
   - ถ้ามี error ให้ตรวจสอบว่า URL และ Key ถูกต้อง

3. **ทดสอบ connection:**
   - เปิด browser console
   - ตรวจสอบว่า Supabase client ทำงานได้

## 🔍 Troubleshooting

### Error: Missing Supabase environment variables
- ตรวจสอบว่าไฟล์ `.env.local` มีอยู่จริง
- ตรวจสอบว่า URL และ Key ถูกต้อง
- Restart dev server

### Error: Invalid API key
- ตรวจสอบว่าใช้ anon key (ไม่ใช่ service_role key)
- ตรวจสอบว่า key ไม่มี space หรือ newline

### Error: Failed to fetch
- ตรวจสอบว่า Supabase project ยัง active อยู่
- ตรวจสอบว่า URL ถูกต้อง

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Dashboard](https://app.supabase.com)
- [Environment Variables in Vite](https://vitejs.dev/guide/env-and-mode.html)

