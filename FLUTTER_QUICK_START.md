# 🚀 Flutter Quick Start Guide - Customer Ordering App

## ⚠️ หมายเหตุสำคัญ

**แอพมือถือนี้แยกจากโปรเจกต์ Vehicle Control Center**

- **Mobile App (Flutter)**: สำหรับลูกค้าสั่งสินค้าเท่านั้น
- **Web App (โปรเจกต์ปัจจุบัน)**: สำหรับฝ่ายขาย + คลังและจัดส่ง + บริหารรถ

ทั้งสองแอพใช้ **Supabase database เดียวกัน** แต่มีหน้าที่ต่างกัน

**หมายเหตุ:** ฝ่ายขายใช้ Web App ไม่ใช่ Mobile App

---

## 📋 Quick Start

### 1. ติดตั้ง Flutter

```powershell
# ตรวจสอบว่า Flutter ติดตั้งแล้วหรือยัง
flutter --version

# ถ้ายังไม่มี ให้ดาวน์โหลดจาก https://flutter.dev/docs/get-started/install/windows
```

### 2. ตรวจสอบ Environment

```powershell
flutter doctor
```

แก้ไข issues ที่แสดง (เช่น ติดตั้ง Android Studio, VS Code, etc.)

### 3. สร้าง Flutter Project

```powershell
# ไปที่ parent directory
cd C:\Users\pepsi\projects

# สร้าง Flutter project สำหรับแอพสั่งสินค้า
flutter create customer_order_app

# เข้าไปในโปรเจกต์
cd customer_order_app
```

### 4. เปิดโปรเจกต์ใน VS Code

```powershell
code .
```

### 5. ติดตั้ง Dependencies

แก้ไข `pubspec.yaml` และเพิ่ม dependencies ตาม [`docs/FLUTTER_MOBILE_APP_SETUP.md`](./docs/FLUTTER_MOBILE_APP_SETUP.md)

จากนั้นรัน:

```powershell
flutter pub get
```

### 6. ตั้งค่า Supabase

1. ใช้ Supabase credentials เดียวกับ web app
2. รัน SQL migration: `sql/20260120000000_create_orders_system.sql`
3. ตั้งค่า environment variables (`.env`)

### 7. รันแอพ

```powershell
# เปิด Android Emulator ก่อน (จาก Android Studio)
flutter run
```

---

## 📁 โครงสร้างโปรเจกต์

```
customer_order_app/
├── lib/
│   ├── main.dart
│   ├── models/          # Order, Product, Store, etc.
│   ├── screens/
│   │   ├── auth/        # Login, Register
│   │   └── customer/    # Customer app screens (สั่งสินค้า, ดูออเดอร์)
│   ├── widgets/         # Reusable widgets
│   ├── services/        # Supabase services
│   ├── providers/       # State management
│   └── utils/           # Helpers
└── assets/
```

---

## 🔗 Integration กับ Web App

### Database Tables ที่ใช้ร่วมกัน

- `stores` - ร้านค้า/ลูกค้า
- `products` - สินค้า
- `orders` - ออเดอร์ (สร้างใหม่)
- `order_items` - รายการสินค้า (สร้างใหม่)
- `delivery_trips` - ทริปส่งสินค้า (web app จัดการ)
- `delivery_trip_stores` - ร้านค้าในทริป
- `delivery_trip_items` - รายการสินค้าในทริป

### Flow การทำงาน

```
Customer App (Mobile - Flutter)
  ↓ สร้างออเดอร์
Orders Table
  ↓
Web App (Sales - React)
  ↓ ฝ่ายขายส่งให้คลัง
Web App (Warehouse - React)
  ↓ คลังจัดคิวส่ง
Web App (Sales - React)
  ↓ ฝ่ายขายออกบิล
Web App (Warehouse - React)
  ↓ คลังส่งสินค้า
```

---

## 📝 Next Steps

1. ✅ สร้าง Flutter project
2. ✅ Setup Supabase
3. ✅ รัน database migration
4. ⬜ สร้าง Authentication flow
5. ⬜ สร้าง Customer app screens (สั่งสินค้า, ดูออเดอร์, ติดตาม)
6. ⬜ เพิ่ม Real-time updates
7. ⬜ เพิ่ม Push notifications

**หมายเหตุ:** Sales features จะอยู่ใน Web App (React) ไม่ใช่ Mobile App

---

## 📚 Documentation

- [`docs/FLUTTER_MOBILE_APP_SETUP.md`](./docs/FLUTTER_MOBILE_APP_SETUP.md) - คู่มือตั้งค่าแบบละเอียด (Customer App เท่านั้น)
- [`docs/FINAL_ARCHITECTURE.md`](./docs/FINAL_ARCHITECTURE.md) - Architecture สุดท้าย (แนะนำให้อ่าน)
- [`docs/CORRECT_WORKFLOW.md`](./docs/CORRECT_WORKFLOW.md) - Workflow ที่ถูกต้อง

