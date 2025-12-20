# 📱 Mobile App Architecture - Customer Ordering & Sales Management

## ภาพรวมระบบ

### แอพมือถือ (Flutter)
- **Customer App**: ลูกค้าสั่งสินค้า, ดูออเดอร์, ติดตามสถานะ

**หมายเหตุ:** ฝ่ายขายใช้ Web App (React) ไม่ใช่ Mobile App

### Web App (โปรเจกต์ปัจจุบัน)
- **Sales Management**: ฝ่ายขายรับออเดอร์, ส่งให้คลัง, ดูคิว, ออกบิล
- **Warehouse Management**: คลังและจัดส่ง จัดคิว, จัดรถ, ติดตามการส่ง
- **Vehicle Management**: บริหารรถ, จัดคิวตามออเดอร์, ติดตามการส่งสินค้า

### Database (Supabase - ใช้ร่วมกัน)
- `stores` - ร้านค้า/ลูกค้า
- `products` - สินค้า
- `orders` - ออเดอร์ที่ลูกค้าสั่ง (ต้องสร้างใหม่)
- `order_items` - รายการสินค้าในออเดอร์ (ต้องสร้างใหม่)
- `delivery_trips` - ทริปส่งสินค้า (มีอยู่แล้ว)
- `delivery_trip_stores` - ร้านค้าในแต่ละทริป (มีอยู่แล้ว)
- `delivery_trip_items` - รายการสินค้าสำหรับแต่ละร้าน (มีอยู่แล้ว)

---

## 📊 Database Schema Design

### 1. Orders Table

```sql
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE, -- รหัสออเดอร์ เช่น ORD-2025-001
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.profiles(id), -- ผู้สั่ง (ถ้าเป็น user)
  sales_person_id UUID REFERENCES public.profiles(id), -- พนักงานขาย
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE, -- วันที่ต้องการรับสินค้า
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',              -- รอขายส่งให้คลัง
    'sent_to_warehouse',    -- ขายส่งให้คลังแล้ว
    'queue_ready',          -- คลังจัดคิวเสร็จแล้ว (พร้อมให้ขายออกบิล)
    'billed',               -- ขายออกบิลแล้ว
    'preparing',            -- กำลังเตรียมสินค้า
    'ready',                -- พร้อมส่ง
    'assigned',             -- มอบหมายให้ทริปแล้ว
    'in_transit',           -- กำลังส่ง
    'delivered',            -- ส่งแล้ว
    'cancelled',            -- ยกเลิก
    'rejected'              -- ปฏิเสธ
  )),
  total_amount DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  delivery_trip_id UUID REFERENCES public.delivery_trips(id) -- เชื่อมกับทริป
);
```

### 2. Order Items Table

```sql
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(10, 2), -- ราคาต่อหน่วย (เก็บไว้สำหรับออเดอร์)
  subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. Order Status History (Optional - สำหรับ tracking)

```sql
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 🏗️ Flutter App Architecture

### Project Structure

```
mobile_app/
├── lib/
│   ├── main.dart
│   │
│   ├── app.dart                    # App configuration
│   ├── routes/                     # Navigation
│   │   ├── app_router.dart
│   │   └── route_names.dart
│   │
│   ├── models/                     # Data models
│   │   ├── order.dart
│   │   ├── order_item.dart
│   │   ├── product.dart
│   │   ├── store.dart
│   │   ├── delivery_trip.dart
│   │   └── user.dart
│   │
│   ├── screens/                    # UI Screens
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── register_screen.dart
│   │   │
│   │   ├── customer/              # Customer App Screens
│   │   │   ├── home_screen.dart
│   │   │   ├── product_catalog_screen.dart
│   │   │   ├── cart_screen.dart
│   │   │   ├── order_form_screen.dart
│   │   │   ├── orders_list_screen.dart
│   │   │   ├── order_detail_screen.dart
│   │   │   └── tracking_screen.dart
│   │   │
│   │   └── sales/                 # Sales App Screens
│   │       ├── dashboard_screen.dart
│   │       ├── orders_pending_screen.dart
│   │       ├── order_approval_screen.dart
│   │       ├── order_detail_screen.dart
│   │       ├── delivery_planning_screen.dart
│   │       └── reports_screen.dart
│   │
│   ├── widgets/                    # Reusable widgets
│   │   ├── common/
│   │   │   ├── app_button.dart
│   │   │   ├── app_text_field.dart
│   │   │   └── loading_indicator.dart
│   │   ├── customer/
│   │   │   ├── product_card.dart
│   │   │   ├── cart_item_card.dart
│   │   │   └── order_status_badge.dart
│   │   └── sales/
│   │       ├── order_card.dart
│   │       └── delivery_trip_card.dart
│   │
│   ├── services/                  # API Services
│   │   ├── supabase_service.dart
│   │   ├── auth_service.dart
│   │   ├── product_service.dart
│   │   ├── order_service.dart
│   │   ├── store_service.dart
│   │   └── delivery_service.dart
│   │
│   ├── providers/                 # State Management (Provider/Riverpod)
│   │   ├── auth_provider.dart
│   │   ├── cart_provider.dart
│   │   ├── order_provider.dart
│   │   └── product_provider.dart
│   │
│   ├── utils/                     # Utilities
│   │   ├── constants.dart
│   │   ├── validators.dart
│   │   ├── formatters.dart
│   │   └── helpers.dart
│   │
│   └── theme/                     # App Theme
│       ├── app_theme.dart
│       └── app_colors.dart
│
├── assets/
│   ├── images/
│   └── icons/
│
└── test/
```

---

## 🔄 User Flows

### Customer Flow

1. **Login/Register** → ตรวจสอบ role = 'customer' หรือ store owner
2. **Browse Products** → ดูสินค้า, ค้นหา, กรองตาม category
3. **Add to Cart** → เพิ่มสินค้าลงตะกร้า
4. **Create Order** → กรอกข้อมูลออเดอร์ (delivery date, notes)
5. **View Orders** → ดูออเดอร์ทั้งหมด, สถานะ
6. **Track Order** → ติดตามสถานะการส่งสินค้า

### Sales Flow (ใช้ Web App ไม่ใช่ Mobile App)

**หมายเหตุ:** Sales features อยู่ใน Web App (React) ไม่ใช่ Mobile App

ดูรายละเอียดที่ [`docs/CORRECT_WORKFLOW.md`](./CORRECT_WORKFLOW.md) และ [`docs/FINAL_ARCHITECTURE.md`](./FINAL_ARCHITECTURE.md)

---

## 🔌 Integration Points

### 1. Authentication
- ใช้ Supabase Auth
- Roles: `customer`, `sales`, `manager`, `admin`
- Customer app: login ด้วย email/password หรือ phone
- Sales app: login ด้วย email/password

### 2. Real-time Updates
- ใช้ Supabase Realtime subscriptions
- Customer: ติดตามสถานะออเดอร์แบบ real-time
- Sales: รับแจ้งเตือนออเดอร์ใหม่

### 3. Push Notifications
- ใช้ Firebase Cloud Messaging (FCM)
- Customer: แจ้งเตือนเมื่อออเดอร์เปลี่ยนสถานะ
- Sales: แจ้งเตือนออเดอร์ใหม่

### 4. Data Sync
- Orders → Delivery Trips (Web app จัดการ)
- Delivery Trips → Order Status (Mobile app อัปเดต)

---

## 📱 Features Breakdown

### Customer App Features

#### Phase 1 (MVP)
- [ ] Authentication (Login/Register)
- [ ] Product Catalog (Browse, Search, Filter)
- [ ] Shopping Cart
- [ ] Create Order
- [ ] View Orders List
- [ ] Order Detail
- [ ] Order Status Tracking

#### Phase 2
- [ ] Order History
- [ ] Favorite Products
- [ ] Push Notifications
- [ ] Order Cancellation
- [ ] Delivery Address Management

#### Phase 3
- [ ] Payment Integration
- [ ] Invoice/Receipt Download
- [ ] Product Reviews
- [ ] Chat with Sales

### Sales App Features

**หมายเหตุ:** Sales features อยู่ใน Web App (React) ไม่ใช่ Mobile App

ดูรายละเอียด Sales features ที่:
- [`docs/FINAL_ARCHITECTURE.md`](./FINAL_ARCHITECTURE.md) - Architecture สุดท้าย
- [`docs/CORRECT_WORKFLOW.md`](./CORRECT_WORKFLOW.md) - Workflow ที่ถูกต้อง
- [`docs/SALES_TEAM_WORKFLOW.md`](./SALES_TEAM_WORKFLOW.md) - Workflow ของฝ่ายขาย

---

## 🔐 Security & Permissions

### Row Level Security (RLS) Policies

#### Orders
- **Customers**: ดูและสร้างออเดอร์ของตัวเองเท่านั้น (Mobile App)
- **Sales**: ดูออเดอร์ทั้งหมด, แก้ไขสถานะ (Web App)
- **Managers/Admins**: Full access (Web App)

#### Order Items
- Same as Orders (inherit from order_id)

#### Products
- **All authenticated users**: Read access
- **Sales/Managers/Admins**: Create/Update/Delete (Web App)

#### Stores
- **All authenticated users**: Read access
- **Customers**: ดูข้อมูลร้านของตัวเอง (Mobile App)
- **Sales/Managers/Admins**: Full access (Web App)

---

## 🚀 Development Phases

### Phase 1: Foundation (Week 1-2)
1. Setup Flutter project
2. Setup Supabase integration
3. Create database schema (orders, order_items)
4. Implement authentication
5. Basic UI structure

### Phase 2: Customer App MVP (Week 3-4)
1. Product catalog
2. Shopping cart
3. Order creation
4. Order list & detail
5. Basic tracking

### Phase 3: Integration & Polish (Week 5-6)
1. Real-time updates
2. Push notifications
3. Error handling
4. UI/UX improvements

**หมายเหตุ:** Sales features อยู่ใน Web App (React) ไม่ใช่ Mobile App

### Phase 4: Testing & Deployment (Week 7-8)
1. Unit testing
2. Integration testing
3. UI/UX testing
4. Performance optimization
5. Deploy to App Store / Play Store

---

## 📦 Dependencies

### Core
```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  provider: ^6.1.1
  # หรือ
  riverpod: ^2.4.9
  flutter_riverpod: ^2.4.9
  
  # Backend
  supabase_flutter: ^2.0.0
  
  # Navigation
  go_router: ^13.0.0
  
  # UI
  cupertino_icons: ^1.0.6
  
  # Local Storage
  shared_preferences: ^2.2.2
  
  # Date & Time
  intl: ^0.19.0
  
  # HTTP
  http: ^1.1.0
  
  # Image Loading
  cached_network_image: ^3.3.0
  
  # Forms
  flutter_form_builder: ^9.1.1
  
  # Notifications
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0
```

---

## 🔄 Data Flow

### Order Creation Flow

```
Customer App
  ↓
1. Add products to cart
  ↓
2. Create order (POST /orders)
  ↓
3. Order status = 'pending'
  ↓
Sales App (Real-time notification)
  ↓
4. Sales reviews order
  ↓
5. Approve/Reject (UPDATE /orders/:id)
  ↓
6. If approved: status = 'approved'
  ↓
Web App (Vehicle Management)
  ↓
7. Sales creates delivery trip from approved orders
  ↓
8. Order status = 'assigned', delivery_trip_id set
  ↓
9. Driver delivers
  ↓
10. Order status = 'delivered'
  ↓
Customer App (Real-time update)
```

---

## 📝 Next Steps

1. ✅ สร้าง database schema สำหรับ orders
2. ✅ Setup Flutter project structure
3. ✅ Implement authentication
4. ✅ Build Customer App MVP
5. ✅ Build Sales App MVP
6. ✅ Integration testing
7. ✅ Deploy to App Store / Play Store

