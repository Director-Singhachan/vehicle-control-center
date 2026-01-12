# คู่มือเริ่มต้น Flutter สำหรับ Vehicle Control Center

## 📋 ขั้นตอนที่ 1: ติดตั้ง Flutter SDK

### Windows

1. **ดาวน์โหลด Flutter SDK:**
   - ไปที่ https://flutter.dev/docs/get-started/install/windows
   - ดาวน์โหลด Flutter SDK (ZIP file)
   - แตกไฟล์ไปที่ `C:\src\flutter` (หรือ path อื่นที่คุณต้องการ)

2. **เพิ่ม Flutter ไปยัง PATH:**
   - เปิด System Properties → Environment Variables
   - เพิ่ม `C:\src\flutter\bin` ไปยัง Path variable
   - หรือใช้ PowerShell:
     ```powershell
     [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\src\flutter\bin", "User")
     ```

3. **ติดตั้ง Git:**
   - Flutter ต้องการ Git
   - ดาวน์โหลดจาก https://git-scm.com/download/win

4. **ตรวจสอบการติดตั้ง:**
   ```bash
   flutter doctor
   ```
   - คำสั่งนี้จะบอกว่าคุณต้องติดตั้งอะไรเพิ่มเติม (Android Studio, VS Code, etc.)

### ติดตั้ง Android Studio (สำหรับ Android development)

1. ดาวน์โหลด Android Studio จาก https://developer.android.com/studio
2. ติดตั้ง Android SDK, Android SDK Platform-Tools, และ Android Emulator
3. เปิด Android Studio → Configure → SDK Manager
4. ติดตั้ง Android SDK (API level 33 หรือใหม่กว่า)

### ติดตั้ง VS Code (แนะนำ)

1. ดาวน์โหลด VS Code จาก https://code.visualstudio.com/
2. ติดตั้ง Flutter extension:
   - เปิด VS Code
   - ไปที่ Extensions (Ctrl+Shift+X)
   - ค้นหา "Flutter" และติดตั้ง
   - จะติดตั้ง Dart extension อัตโนมัติ

---

## 📱 ขั้นตอนที่ 2: สร้าง Flutter Project

### สร้างโปรเจกต์ใหม่

```bash
# ไปที่ directory ที่ต้องการสร้างโปรเจกต์
cd /path/to/projects

# สร้าง Flutter project
flutter create vehicle_control_center_mobile

# เข้าไปในโปรเจกต์
cd vehicle_control_center_mobile
```

### โครงสร้างโปรเจกต์ Flutter

```
vehicle_control_center_mobile/
├── lib/
│   ├── main.dart              # Entry point
│   ├── models/                # Data models
│   ├── screens/               # UI screens
│   ├── widgets/               # Reusable widgets
│   ├── services/              # API services
│   ├── providers/             # State management
│   └── utils/                 # Utilities
├── android/                   # Android specific code
├── ios/                       # iOS specific code
├── test/                      # Unit tests
├── pubspec.yaml               # Dependencies
└── README.md
```

---

## 🔧 ขั้นตอนที่ 3: ตั้งค่า Dependencies

### แก้ไข `pubspec.yaml`

เพิ่ม dependencies ที่จำเป็น:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  provider: ^6.1.1
  
  # HTTP & API
  http: ^1.1.0
  supabase_flutter: ^2.0.0
  
  # UI Components
  cupertino_icons: ^1.0.6
  
  # Navigation
  go_router: ^13.0.0
  
  # Local Storage
  shared_preferences: ^2.2.2
  
  # Date & Time
  intl: ^0.19.0
  
  # Charts (ถ้าต้องการ)
  fl_chart: ^0.66.0
```

### ติดตั้ง dependencies

```bash
flutter pub get
```

---

## 🔐 ขั้นตอนที่ 4: ตั้งค่า Supabase

### ติดตั้ง Supabase Flutter

```bash
flutter pub add supabase_flutter
```

### สร้างไฟล์ `lib/services/supabase_service.dart`

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'YOUR_SUPABASE_URL',
      anonKey: 'YOUR_SUPABASE_ANON_KEY',
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}
```

### ตั้งค่า Environment Variables

สร้างไฟล์ `.env` (ใช้ `flutter_dotenv` package):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 📱 ขั้นตอนที่ 5: สร้างโครงสร้างพื้นฐาน

### 1. สร้าง Authentication Service

`lib/services/auth_service.dart` - สำหรับจัดการ login/logout

### 2. สร้าง Models

`lib/models/` - Vehicle, Trip, Maintenance, etc.

### 3. สร้าง Screens

`lib/screens/` - Login, Dashboard, Vehicles, Trips, etc.

### 4. ตั้งค่า State Management

ใช้ Provider หรือ Riverpod สำหรับจัดการ state

---

## 🚀 ขั้นตอนที่ 6: รันแอพ

### รันบน Android Emulator

```bash
# เปิด Android Emulator ก่อน
flutter run
```

### รันบน iOS Simulator (Mac only)

```bash
flutter run -d ios
```

### รันบนอุปกรณ์จริง

```bash
# เชื่อมต่ออุปกรณ์ผ่าน USB
# เปิด USB debugging (Android) หรือ Trust computer (iOS)
flutter devices  # ดูอุปกรณ์ที่เชื่อมต่อ
flutter run -d <device-id>
```

---

## 📚 Resources เพิ่มเติม

- [Flutter Documentation](https://flutter.dev/docs)
- [Dart Language Tour](https://dart.dev/guides/language/language-tour)
- [Flutter Widget Catalog](https://flutter.dev/docs/development/ui/widgets)
- [Supabase Flutter Documentation](https://supabase.com/docs/reference/dart/introduction)

---

## ✅ Checklist

- [ ] ติดตั้ง Flutter SDK
- [ ] ติดตั้ง Android Studio หรือ Xcode
- [ ] ติดตั้ง VS Code + Flutter extension
- [ ] รัน `flutter doctor` และแก้ไข issues
- [ ] สร้าง Flutter project
- [ ] ตั้งค่า Supabase
- [ ] สร้างโครงสร้างโปรเจกต์
- [ ] รันแอพบน emulator/simulator ได้

---

## 🆘 Troubleshooting

### Flutter doctor แสดง errors

- **Android licenses:** รัน `flutter doctor --android-licenses` และยอมรับ licenses
- **VS Code extension:** ตรวจสอบว่า Flutter extension ติดตั้งแล้ว
- **Emulator:** ตรวจสอบว่า Android Emulator หรือ iOS Simulator เปิดอยู่

### Build errors

```bash
# ล้าง cache และ rebuild
flutter clean
flutter pub get
flutter run
```

### Connection issues

- ตรวจสอบ firewall settings
- ตรวจสอบ network connection
- ลองใช้ `flutter pub cache repair`

