# 🏗️ Final Architecture - ระบบสั่งสินค้าและจัดส่ง

## 📱 แอพพลิเคชัน

### 1. Mobile App (Flutter) - Customer App
**สำหรับ: ลูกค้า**

#### Features:
- ✅ สั่งสินค้า
- ✅ ดูสินค้า (Product Catalog)
- ✅ ตะกร้าสินค้า (Shopping Cart)
- ✅ ดูออเดอร์
- ✅ ติดตามสถานะออเดอร์

#### Technology:
- Flutter (Dart)
- Supabase (Backend)
- Firebase Cloud Messaging (Push Notifications)

---

### 2. Web App (React) - Vehicle Control Center
**สำหรับ: พนักงานขาย + คลังและจัดส่ง**

#### สำหรับฝ่ายขาย (Sales):
- ✅ รับออเดอร์จากลูกค้า
- ✅ ส่งออเดอร์ให้คลัง
- ✅ ดูคิวที่คลังจัดให้
- ✅ ออกบิลตามลำดับคิว

#### สำหรับคลังและจัดส่ง (Warehouse):
- ✅ ดูออเดอร์ที่ขายส่งมา
- ✅ จัดคิวส่ง (กำหนดลำดับร้าน)
- ✅ สร้าง delivery trips
- ✅ จัดรถและพนักงานขับ
- ✅ ติดตามการส่งสินค้า

#### Technology:
- React + TypeScript
- Vite
- Supabase (Backend)
- Tailwind CSS

---

## 🔄 Workflow

```
┌─────────────────────────────────────────────────┐
│  1. Customer สั่งสินค้า                          │
│     → Mobile App (Flutter)                      │
│     → สร้าง order (status: 'pending')            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  2. พนักงานขายดูออเดอร์ใหม่                       │
│     → Web App (React)                           │
│     → ดูออเดอร์ status: 'pending'              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  3. พนักงานขายส่งข้อมูลให้คลังและจัดส่ง           │
│     → Web App (React)                            │
│     → ส่งออเดอร์ไปยังคลัง                        │
│     → status: 'sent_to_warehouse'               │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  4. คลังและจัดส่งดูออเดอร์ของวันนั้น             │
│     → Web App (React)                            │
│     → ดูออเดอร์ status: 'sent_to_warehouse'     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  5. คลังและจัดส่งจัดคิวส่ง                       │
│     → Web App (React)                            │
│     → จัดลำดับร้านที่จะส่ง                       │
│     → สร้าง delivery_trips                       │
│     → กำหนด sequence_order                      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  6. คลังและจัดส่งส่งคิวให้ขายดู                  │
│     → Web App (React)                            │
│     → อัปเดต delivery_trips                     │
│     → status: 'queue_ready'                     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  7. พนักงานขายดูคิวที่คลังจัดให้                  │
│     → Web App (React)                            │
│     → ดูลำดับร้านที่จะส่ง                        │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  8. พนักงานขายออกบิลตามลำดับคิว                  │
│     → Web App (React)                            │
│     → ออกบิลตาม sequence_order                  │
│     → status: 'billed'                          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  9. คลังและจัดส่งส่งสินค้า                        │
│     → Web App (React)                            │
│     → จัดรถ, พนักงานขับ                          │
│     → ส่งสินค้าตามคิว                            │
│     → status: 'delivered'                       │
└─────────────────────────────────────────────────┘
```

---

## 🗄️ Database (Supabase)

### Tables

#### Orders System
- `orders` - ออเดอร์
- `order_items` - รายการสินค้าในออเดอร์
- `order_status_history` - ประวัติการเปลี่ยนสถานะ

#### Delivery System (มีอยู่แล้ว)
- `delivery_trips` - ทริปส่งสินค้า
- `delivery_trip_stores` - ร้านค้าในแต่ละทริป
- `delivery_trip_items` - รายการสินค้าสำหรับแต่ละร้าน

#### Master Data
- `stores` - ร้านค้า/ลูกค้า
- `products` - สินค้า
- `profiles` - ผู้ใช้

---

## 🔐 Roles & Permissions

### Customer
- **Mobile App**: Full access (สั่งสินค้า, ดูออเดอร์)
- **Web App**: No access

### Sales
- **Mobile App**: No access
- **Web App**: Full access (รับออเดอร์, ส่งให้คลัง, ดูคิว, ออกบิล)

### Warehouse/Logistics
- **Mobile App**: No access
- **Web App**: Full access (จัดคิว, จัดรถ, ติดตาม)

### Manager
- **Mobile App**: No access (หรือ read-only)
- **Web App**: Full access (ทุกอย่าง)

---

## 📦 Technology Stack

### Mobile App (Customer)
- **Framework**: Flutter (Dart)
- **Backend**: Supabase
- **State Management**: Provider / Riverpod
- **Navigation**: GoRouter
- **Notifications**: Firebase Cloud Messaging

### Web App (Sales + Warehouse)
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Backend**: Supabase
- **State Management**: Zustand
- **UI**: Tailwind CSS
- **Routing**: React Router

---

## 🚀 Development Plan

### Phase 1: Database & Backend
- [x] สร้าง orders system tables
- [x] สร้าง RLS policies
- [x] สร้าง triggers และ functions

### Phase 2: Mobile App (Customer)
- [ ] Setup Flutter project
- [ ] Authentication
- [ ] Product Catalog
- [ ] Shopping Cart
- [ ] Create Order
- [ ] View Orders
- [ ] Order Tracking

### Phase 3: Web App (Sales Features)
- [ ] Orders Management View
- [ ] Send Orders to Warehouse
- [ ] View Queue
- [ ] Issue Bills

### Phase 4: Web App (Warehouse Features)
- [ ] View Orders from Sales
- [ ] Create Delivery Queue
- [ ] Assign Vehicles
- [ ] Track Delivery

### Phase 5: Integration & Testing
- [ ] Real-time updates
- [ ] Push notifications
- [ ] Error handling
- [ ] Testing

---

## 📝 สรุป

### แอพที่ต้องสร้าง/แก้ไข:

1. **Mobile App (Flutter)** - Customer App
   - สร้างใหม่ทั้งหมด
   - สำหรับลูกค้าสั่งสินค้า

2. **Web App (React)** - Vehicle Control Center
   - มีอยู่แล้ว (โปรเจกต์ปัจจุบัน)
   - เพิ่ม features สำหรับฝ่ายขาย:
     - Orders Management
     - Send to Warehouse
     - View Queue
     - Issue Bills
   - Features สำหรับคลังมีอยู่แล้ว:
     - Delivery Trip Management
     - Vehicle Management

### Database:
- ใช้ Supabase เดียวกัน
- เพิ่ม orders system tables
- ใช้ delivery system ที่มีอยู่แล้ว

