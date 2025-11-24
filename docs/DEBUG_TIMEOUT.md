# 🔍 คู่มือ Debug ปัญหา Timeout

## 📊 สถานการณ์ปัจจุบัน

จาก logs ที่เห็น:
- ✅ API calls เริ่มทำงานแล้ว (`[vehicleService] Fetching summary...`)
- ❌ แต่ทุก API call timeout หลังจาก 30 วินาที
- ❌ ไม่มี logs แสดงผลลัพธ์จาก queries
- ❌ ไม่มี log `[vehicleService] User authenticated: X`

## 🔍 ขั้นตอน Debug

### 1. ตรวจสอบ Environment Variables

เปิด Browser Console (F12) และดู logs:
```
[Supabase Config] URL: https://xxxx...
[Supabase Config] Key: eyJhbGciOiJIUzI1NiIs...
```

**ถ้าเห็น:**
- `❌ NOT SET` → Environment variables ไม่ถูกโหลด
- `https://placeholder.supabase.co` → ใช้ค่า placeholder

**วิธีแก้ไข:**
1. ตรวจสอบว่าไฟล์ `.env.local` อยู่ในโฟลเดอร์ root
2. ตรวจสอบว่า restart dev server แล้ว (`Ctrl+C` แล้ว `npm run dev`)
3. ตรวจสอบว่า URL และ Key ถูกต้อง

### 2. ตรวจสอบ Supabase Client

ดู logs:
```
[vehicleService] Supabase client initialized: true
[vehicleService] Supabase auth available: true
```

**ถ้าเห็น `false`** → Supabase client ไม่ถูก initialize

### 3. ตรวจสอบ Authentication

ดู logs:
```
[vehicleService] Checking authentication...
[vehicleService] getSession() took Xms
[vehicleService] User authenticated: X
```

**ถ้าไม่มี log `User authenticated`** → User ไม่ authenticated หรือ session หมดอายุ

**วิธีแก้ไข:**
1. Logout และ login ใหม่
2. ตรวจสอบว่า session ถูกเก็บใน localStorage
3. ตรวจสอบว่า Supabase Auth settings ถูกต้อง

### 4. ทดสอบ Connection โดยตรง

ใน Browser Console:
```javascript
// 1. ตรวจสอบ session
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('Session Error:', sessionError);

// 2. ทดสอบ query ง่ายๆ
const { data, error, count } = await supabase
  .from('vehicles')
  .select('*', { count: 'exact', head: true });
console.log('Query Result:', { data, error, count });
```

**ถ้าเห็น error:**
- `401 Unauthorized` → Authentication problem
- `403 Forbidden` → RLS policy problem
- `Network error` → Connection problem
- `Timeout` → Query ใช้เวลานานเกินไป

### 5. ตรวจสอบ Network Tab

1. เปิด Browser DevTools → Network tab
2. Filter: `supabase.co`
3. Refresh หน้าเว็บ
4. ดู requests ไป Supabase

**ดู:**
- Status code (200, 401, 403, 500, etc.)
- Response time
- Request URL
- Response body (ถ้ามี error)

### 6. ทดสอบ Queries ใน Supabase SQL Editor

1. ไปที่ Supabase Dashboard → SQL Editor
2. รัน queries:
```sql
-- ทดสอบ vehicles table
SELECT COUNT(*) FROM vehicles;

-- ทดสอบ vehicle_usage table
SELECT COUNT(*) FROM vehicle_usage WHERE status = 'in_progress';

-- ทดสอบ tickets table
SELECT COUNT(*) FROM tickets;

-- ทดสอบ views
SELECT * FROM vehicle_dashboard LIMIT 5;
SELECT * FROM vehicles_with_status LIMIT 5;
```

**ถ้า queries ใช้เวลานาน:**
- อาจเป็นเพราะ views ซับซ้อน
- อาจเป็นเพราะไม่มี indexes
- อาจเป็นเพราะข้อมูลจำนวนมาก

## 🛠️ วิธีแก้ไข

### ถ้า Environment Variables ไม่ถูกโหลด:

1. ตรวจสอบว่าไฟล์ `.env.local` อยู่ในโฟลเดอร์ root
2. ตรวจสอบว่า restart dev server แล้ว
3. ตรวจสอบว่าไม่มี typo ในชื่อตัวแปร

### ถ้า User ไม่ authenticated:

1. Logout และ login ใหม่
2. ตรวจสอบว่า Supabase Auth settings ถูกต้อง
3. ตรวจสอบว่า session ถูกเก็บใน localStorage

### ถ้า Queries timeout:

1. ลด timeout จาก 30 วินาทีเป็น 60 วินาที
2. Optimize queries (เพิ่ม indexes, simplify views)
3. ใช้ pagination สำหรับข้อมูลจำนวนมาก

### ถ้า Network error:

1. ตรวจสอบว่า VPN หรือ firewall ไม่บล็อก Supabase
2. ตรวจสอบว่า Supabase project ยัง active อยู่
3. ตรวจสอบว่า URL ถูกต้อง

## 📝 Logs ที่ควรดู

### Console Logs:
- `[Supabase Config] URL:` - Environment variables ถูกโหลดหรือไม่
- `[vehicleService] Supabase client initialized:` - Supabase client ถูก initialize หรือไม่
- `[vehicleService] Checking authentication...` - เริ่มตรวจสอบ authentication
- `[vehicleService] getSession() took Xms` - เวลาที่ใช้ในการ get session
- `[vehicleService] User authenticated: X` - User authenticated หรือไม่
- `[vehicleService] Total vehicles: X` - Queries เสร็จหรือไม่

### Network Tab:
- Requests ไป Supabase
- Status code และ response time
- Error messages (ถ้ามี)

## 🎯 ขั้นตอนต่อไป

1. **ดู Console Logs** - ดูว่า environment variables ถูกโหลดหรือไม่
2. **ทดสอบ Connection** - รัน queries ใน Browser Console
3. **ตรวจสอบ Network** - ดู requests ใน Network tab
4. **ทดสอบ Queries** - รัน queries ใน Supabase SQL Editor

## 🔗 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Query Performance](https://supabase.com/docs/guides/database/query-optimization)
- [Supabase Connection Issues](https://supabase.com/docs/guides/getting-started/troubleshooting)

