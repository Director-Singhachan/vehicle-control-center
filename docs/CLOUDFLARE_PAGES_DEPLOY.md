# Cloudflare Pages Deploy

## ถ้าเจอ "Failed to publish your Function. Unknown internal error"

โปรเจกต์นี้เป็น **static SPA** (Vite) ไม่ได้ใช้ Cloudflare Pages Functions แต่บางครั้ง deploy จะล้มที่ขั้น "Publish your Function" (เป็น known issue ฝั่ง Cloudflare)

### วิธีแก้ที่ลองได้

1. **ใช้ wrangler.toml**  
   โปรเจกต์มีไฟล์ `wrangler.toml` แล้ว (ชื่อโปรเจกต์ + `pages_build_output_dir = "./dist"`) ให้ commit และ push แล้วลอง deploy ใหม่ — บางเคสการมี config ชัดเจนช่วยให้ไม่พยายาม publish Function

2. **ปิด Functions ใน Dashboard**  
   - เข้า [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → เลือกโปรเจกต์ **vehicle-control-center**  
   - ไปที่ **Settings** → **Functions**  
   - ถ้ามีตัวเลือกเกี่ยวกับ Pages Functions ให้ลองปิดหรือตั้งเป็น "None" / static only แล้ว deploy ใหม่

3. **Deploy ซ้ำ**  
   บางครั้งเป็น transient error ของ Cloudflare — ลองกด **Retry deployment** ในหน้า Deployments

4. **ตรวจสอบ Build output**  
   - Build ต้องจบที่ `dist/` (Vite)  
   - ต้องไม่มีโฟลเดอร์ `functions` ที่ root (โปรเจกต์นี้ไม่มี)  
   - ต้องไม่มี `_worker.js` ใน `dist/` (ถ้ามีอาจทำให้ Cloudflare พยายาม deploy เป็น Function)

ถ้ายังไม่ผ่าน: ดู [Cloudflare Community](https://community.cloudflare.com/t/getting-error-failed-to-publish-your-function-when-not-using-functions/548362) หรือแจ้ง Cloudflare Support พร้อม log การ deploy
