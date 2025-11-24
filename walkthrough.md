# Walkthrough - Driver Role & Mobile Optimization

## Overview
We have implemented a new **Driver** role with a simplified login experience and mobile-optimized interface. This allows drivers to easily report issues using their phone numbers without needing complex email/password setups.

## Changes

### 1. Driver Role & Access Control
- **New Role**: Added `'driver'` to the system.
- **Restricted Access**: Drivers can *only* access:
    - **Maintenance**: To create and view tickets.
    - **Profile**: To view their info.
    - **Settings**: Basic settings.
- **Navigation**: Drivers are automatically redirected to the "Maintenance" page upon login. The Sidebar hides Dashboard, Vehicles, and Reports.

### 2. Simplified Login (Phone Number)
- **Phone as Username**: Drivers can log in using their 10-digit phone number (e.g., `0812345678`).
- **Automatic Domain**: The system automatically appends `@driver.local` to the phone number (e.g., `0812345678@driver.local`) for authentication.
- **No SMS Cost**: This uses the existing email/password infrastructure, avoiding SMS fees.

### 3. Mobile Optimization
- **Camera Integration**: The "Upload" button on the Ticket Form now opens the camera directly on mobile devices (`capture="environment"`).
- **Touch-Friendly**: Buttons and inputs are sized for easy tapping.

## Verification Steps

### 1. Database Migration
Run the following SQL to add the driver role:
```sql
-- Run in Supabase SQL Editor
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver'));
```

### 2. Create a Driver User
1.  Go to Supabase Authentication.
2.  Add a new user:
    - **Email**: `0812345678@driver.local` (Replace with actual phone number)
    - **Password**: `123456` (Or any simple password)
3.  Go to `public.profiles` table and set this user's `role` to `'driver'`.

### 3. Test Login
1.  Open the app.
2.  Enter `0812345678` in the "Email or Phone Number" field.
3.  Enter the password.
4.  **Verify**: You should be redirected to the **Maintenance** page.
5.  **Verify**: The Sidebar should *not* show Dashboard or Vehicles.

### 4. Test Mobile Ticket Creation
1.  On a mobile device (or simulator), click "Create Ticket".
2.  **Verify**: The form is easy to read and tap.
3.  Click "Upload Image".
4.  **Verify**: It prompts to use the Camera.
