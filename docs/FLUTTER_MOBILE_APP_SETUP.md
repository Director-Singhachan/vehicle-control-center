# 📱 Flutter Mobile App Setup Guide

## ภาพรวม

แอพมือถือ Flutter สำหรับ:
- **Customer App**: ลูกค้าสั่งสินค้า, ดูออเดอร์, ติดตามสถานะ

**หมายเหตุ:** ฝ่ายขายใช้ Web App (React) ไม่ใช่ Mobile App

---

## 📋 ขั้นตอนที่ 1: ติดตั้ง Flutter SDK

### Windows

1. **ดาวน์โหลด Flutter SDK:**
   - ไปที่ https://flutter.dev/docs/get-started/install/windows
   - ดาวน์โหลด Flutter SDK (ZIP file)
   - แตกไฟล์ไปที่ `C:\src\flutter`

2. **เพิ่ม Flutter ไปยัง PATH:**
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\src\flutter\bin", "User")
   ```

3. **ติดตั้ง Git:**
   - ดาวน์โหลดจาก https://git-scm.com/download/win

4. **ตรวจสอบการติดตั้ง:**
   ```bash
   flutter doctor
   ```

### ติดตั้ง Android Studio

1. ดาวน์โหลด Android Studio จาก https://developer.android.com/studio
2. ติดตั้ง Android SDK (API level 33 หรือใหม่กว่า)
3. สร้าง Android Virtual Device (AVD) สำหรับทดสอบ

### ติดตั้ง VS Code + Flutter Extension

1. ติดตั้ง VS Code
2. ติดตั้ง Flutter extension (จะติดตั้ง Dart extension อัตโนมัติ)

---

## 🚀 ขั้นตอนที่ 2: สร้าง Flutter Project

### สร้างโปรเจกต์ใหม่

```bash
# ไปที่ directory ที่ต้องการ
cd C:\Users\pepsi\projects

# สร้าง Flutter project
flutter create customer_order_app

# เข้าไปในโปรเจกต์
cd customer_order_app
```

### โครงสร้างโปรเจกต์ที่แนะนำ

```
customer_order_app/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   │
│   ├── models/
│   │   ├── order.dart
│   │   ├── order_item.dart
│   │   ├── product.dart
│   │   ├── store.dart
│   │   └── user.dart
│   │
│   ├── screens/
│   │   ├── auth/
│   │   ├── customer/
│   │   └── sales/
│   │
│   ├── widgets/
│   │   ├── common/
│   │   ├── customer/
│   │   └── sales/
│   │
│   ├── services/
│   │   ├── supabase_service.dart
│   │   ├── auth_service.dart
│   │   ├── order_service.dart
│   │   └── product_service.dart
│   │
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── cart_provider.dart
│   │   └── order_provider.dart
│   │
│   ├── utils/
│   │   ├── constants.dart
│   │   └── helpers.dart
│   │
│   └── theme/
│       └── app_theme.dart
│
├── assets/
└── test/
```

---

## 📦 ขั้นตอนที่ 3: ตั้งค่า Dependencies

### แก้ไข `pubspec.yaml`

```yaml
name: customer_order_app
description: Mobile app for customer ordering and sales management
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State Management
  provider: ^6.1.1
  
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
  
  # Notifications (Optional)
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  
  assets:
    - assets/images/
    - assets/icons/
```

### ติดตั้ง dependencies

```bash
flutter pub get
```

---

## 🔐 ขั้นตอนที่ 4: ตั้งค่า Supabase

### 1. สร้างไฟล์ `lib/services/supabase_service.dart`

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static Future<void> initialize({
    required String url,
    required String anonKey,
  }) async {
    await Supabase.initialize(
      url: url,
      anonKey: anonKey,
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
  
  static GoTrueClient get auth => Supabase.instance.client.auth;
}
```

### 2. สร้างไฟล์ `.env` (ใช้ flutter_dotenv)

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. เพิ่ม flutter_dotenv

```yaml
dependencies:
  flutter_dotenv: ^5.1.0
```

### 4. โหลด environment variables ใน `main.dart`

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Load .env file
  await dotenv.load(fileName: ".env");
  
  // Initialize Supabase
  await SupabaseService.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );
  
  runApp(MyApp());
}
```

---

## 🗄️ ขั้นตอนที่ 5: รัน Database Migration

### รัน SQL migration สำหรับ orders system

1. เปิด Supabase Dashboard
2. ไปที่ SQL Editor
3. รันไฟล์ `sql/20260120000000_create_orders_system.sql`
4. ตรวจสอบว่า tables สร้างสำเร็จ:
   - `orders`
   - `order_items`
   - `order_status_history`

---

## 📱 ขั้นตอนที่ 6: สร้างโครงสร้างพื้นฐาน

### 1. สร้าง Models

#### `lib/models/order.dart`

```dart
class Order {
  final String id;
  final String orderNumber;
  final String storeId;
  final String? customerId;
  final String? salesPersonId;
  final DateTime orderDate;
  final DateTime? deliveryDate;
  final OrderStatus status;
  final double totalAmount;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? deliveryTripId;

  Order({
    required this.id,
    required this.orderNumber,
    required this.storeId,
    this.customerId,
    this.salesPersonId,
    required this.orderDate,
    this.deliveryDate,
    required this.status,
    required this.totalAmount,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.deliveryTripId,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'],
      orderNumber: json['order_number'],
      storeId: json['store_id'],
      customerId: json['customer_id'],
      salesPersonId: json['sales_person_id'],
      orderDate: DateTime.parse(json['order_date']),
      deliveryDate: json['delivery_date'] != null 
          ? DateTime.parse(json['delivery_date']) 
          : null,
      status: OrderStatus.fromString(json['status']),
      totalAmount: (json['total_amount'] ?? 0).toDouble(),
      notes: json['notes'],
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
      deliveryTripId: json['delivery_trip_id'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_number': orderNumber,
      'store_id': storeId,
      'customer_id': customerId,
      'sales_person_id': salesPersonId,
      'order_date': orderDate.toIso8601String(),
      'delivery_date': deliveryDate?.toIso8601String(),
      'status': status.toString(),
      'total_amount': totalAmount,
      'notes': notes,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'delivery_trip_id': deliveryTripId,
    };
  }
}

enum OrderStatus {
  pending,
  approved,
  preparing,
  ready,
  assigned,
  delivered,
  cancelled,
  rejected;

  static OrderStatus fromString(String status) {
    return OrderStatus.values.firstWhere(
      (e) => e.toString().split('.').last == status,
      orElse: () => OrderStatus.pending,
    );
  }

  @override
  String toString() {
    return name;
  }
}
```

### 2. สร้าง Services

#### `lib/services/order_service.dart`

```dart
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/order.dart';
import 'supabase_service.dart';

class OrderService {
  final _client = SupabaseService.client;

  // Create order
  Future<Order> createOrder({
    required String storeId,
    required DateTime deliveryDate,
    String? notes,
  }) async {
    final response = await _client
        .from('orders')
        .insert({
          'store_id': storeId,
          'customer_id': _client.auth.currentUser?.id,
          'delivery_date': deliveryDate.toIso8601String(),
          'notes': notes,
        })
        .select()
        .single();

    return Order.fromJson(response);
  }

  // Get orders for current user
  Future<List<Order>> getMyOrders() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('Not authenticated');

    final response = await _client
        .from('orders')
        .select()
        .eq('customer_id', userId)
        .order('created_at', ascending: false);

    return (response as List)
        .map((json) => Order.fromJson(json))
        .toList();
  }

  // Get order by ID
  Future<Order> getOrderById(String orderId) async {
    final response = await _client
        .from('orders')
        .select()
        .eq('id', orderId)
        .single();

    return Order.fromJson(response);
  }

  // Update order status
  Future<Order> updateOrderStatus(
    String orderId,
    OrderStatus status,
  ) async {
    final response = await _client
        .from('orders')
        .update({
          'status': status.toString(),
          'approved_by': _client.auth.currentUser?.id,
          'approved_at': DateTime.now().toIso8601String(),
        })
        .eq('id', orderId)
        .select()
        .single();

    return Order.fromJson(response);
  }
}
```

### 3. สร้าง Providers (State Management)

#### `lib/providers/auth_provider.dart`

```dart
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  bool _isLoading = false;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _init();
  }

  void _init() {
    _user = SupabaseService.auth.currentUser;
    SupabaseService.auth.onAuthStateChange.listen((data) {
      _user = data.session?.user;
      notifyListeners();
    });
  }

  Future<void> signIn(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await SupabaseService.auth.signInWithPassword(
        email: email,
        password: password,
      );
      _user = response.user;
    } catch (e) {
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await SupabaseService.auth.signOut();
    _user = null;
    notifyListeners();
  }
}
```

---

## 🎨 ขั้นตอนที่ 7: สร้าง UI Screens

### 1. Login Screen

#### `lib/screens/auth/login_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('เข้าสู่ระบบ')),
      body: Form(
        key: _formKey,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'อีเมล',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'กรุณากรอกอีเมล';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(
                  labelText: 'รหัสผ่าน',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'กรุณากรอกรหัสผ่าน';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              Consumer<AuthProvider>(
                builder: (context, auth, child) {
                  return ElevatedButton(
                    onPressed: auth.isLoading
                        ? null
                        : () async {
                            if (_formKey.currentState!.validate()) {
                              try {
                                await auth.signIn(
                                  _emailController.text,
                                  _passwordController.text,
                                );
                                if (context.mounted) {
                                  Navigator.pushReplacementNamed(
                                    context,
                                    '/home',
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('เข้าสู่ระบบล้มเหลว: $e'),
                                    ),
                                  );
                                }
                              }
                            }
                          },
                    child: auth.isLoading
                        ? const CircularProgressIndicator()
                        : const Text('เข้าสู่ระบบ'),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## 🚀 ขั้นตอนที่ 8: รันแอพ

### รันบน Android Emulator

```bash
# เปิด Android Emulator ก่อน
flutter run
```

### รันบนอุปกรณ์จริง

```bash
# เชื่อมต่ออุปกรณ์ผ่าน USB
flutter devices  # ดูอุปกรณ์ที่เชื่อมต่อ
flutter run -d <device-id>
```

---

## 📚 Next Steps

1. ✅ Setup Flutter project
2. ✅ Setup Supabase
3. ✅ Create database schema
4. ⬜ Implement authentication
5. ⬜ Build Customer App screens
6. ⬜ Build Sales App screens
7. ⬜ Add real-time updates
8. ⬜ Add push notifications
9. ⬜ Testing
10. ⬜ Deploy to stores

ดูรายละเอียดเพิ่มเติมที่ [`MOBILE_APP_ARCHITECTURE.md`](./MOBILE_APP_ARCHITECTURE.md)

