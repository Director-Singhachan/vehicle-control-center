# 🌿 Git Branch Naming Guide

## 📋 Branch Names สำหรับ Orders System

### Main Branch
- `main` หรือ `master` - Production-ready code

### Feature Branches

#### สำหรับ Orders System (แนะนำ)
```bash
feature/orders-system
```
**คำอธิบาย:** Branch หลักสำหรับระบบ orders ทั้งหมด

#### แยกตาม Component (ถ้าต้องการ)
```bash
# Database & Backend
feature/orders-database-schema
feature/orders-api

# Mobile App (Customer)
feature/mobile-customer-orders
feature/customer-ordering-app

# Web App (Sales)
feature/web-sales-orders
feature/sales-order-management

# Web App (Warehouse)
feature/web-warehouse-queue
feature/warehouse-delivery-queue
```

---

## 🎯 Branch ที่แนะนำสำหรับเริ่มต้น

### Option 1: Branch เดียว (แนะนำ)
```bash
feature/orders-system
```
**เหมาะสำหรับ:** พัฒนาทั้งระบบพร้อมกัน

### Option 2: แยกตาม Phase
```bash
# Phase 1: Database
feature/orders-database

# Phase 2: Mobile App
feature/mobile-customer-orders

# Phase 3: Web App Sales
feature/web-sales-orders

# Phase 4: Web App Warehouse
feature/web-warehouse-integration
```

---

## 📝 Branch Naming Convention

### Format
```
<type>/<description>
```

### Types
- `feature/` - ฟีเจอร์ใหม่
- `fix/` - แก้ไข bug
- `hotfix/` - แก้ไขด่วน
- `refactor/` - ปรับปรุงโค้ด
- `docs/` - เอกสาร
- `test/` - ทดสอบ

### Examples
```bash
feature/orders-system
feature/customer-mobile-app
feature/sales-order-management
fix/orders-status-update
docs/orders-workflow
```

---

## 🚀 คำสั่ง Git

### สร้าง Branch
```bash
# สร้าง branch ใหม่
git checkout -b feature/orders-system

# หรือ
git switch -c feature/orders-system
```

### Push Branch
```bash
# Push branch ไปยัง remote
git push -u origin feature/orders-system
```

### Merge Branch
```bash
# Switch ไปที่ main
git checkout main

# Merge feature branch
git merge feature/orders-system

# หรือใช้ Pull Request (แนะนำ)
```

---

## 📋 Checklist สำหรับ Branch

- [ ] สร้าง branch จาก `main` ที่เป็น latest
- [ ] ตั้งชื่อ branch ให้สื่อความหมาย
- [ ] Commit บ่อยๆ ด้วย message ที่ชัดเจน
- [ ] Push branch ไปยัง remote
- [ ] สร้าง Pull Request เมื่อพร้อม

---

## 🎯 Branch ที่แนะนำสำหรับโปรเจกต์นี้

### สำหรับเริ่มต้น
```bash
feature/orders-system
```

**เหตุผล:**
- สื่อความหมายชัดเจน
- ครอบคลุมทั้งระบบ
- ง่ายต่อการจัดการ
- มาตรฐาน Git flow

### ถ้าต้องการแยกตาม Component
```bash
# 1. Database first
feature/orders-database-schema

# 2. Mobile App
feature/mobile-customer-orders

# 3. Web App Sales
feature/web-sales-orders

# 4. Web App Warehouse Integration
feature/web-warehouse-queue-management
```

