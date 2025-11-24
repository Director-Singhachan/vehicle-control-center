# Implementation Plan - Driver Role, Simplified Login & Mobile Optimization

## Goal
Implement a 'driver' role with restricted access, simplified "Phone Number Login", and a mobile-optimized ticket creation experience.

## Proposed Changes

### 1. Database (SQL)
- **New Migration**: Create `sql/20251206000000_add_driver_role.sql` to add `'driver'` to the `app_role` enum/constraint.

### 2. Types (`types/database.ts`)
- **Update `AppRole`**: Add `'driver'` to the union type.

### 3. Authentication (`stores/authStore.ts`, `hooks/useAuth.ts`)
- **Update Store**: Add `isDriver` computed property.
- **Update Hook**: Expose `isDriver` from `useAuth`.

### 4. Simplified Login (`views/LoginView.tsx`)
- **UI Update**: Change "Email" label to "Email or Phone Number".
- **Logic Update**:
    - Auto-append `@driver.local` domain for phone number inputs (e.g., `0812345678` -> `0812345678@driver.local`).
    - Allow simple passwords.

### 5. Route Protection (`components/ProtectedRoute.tsx`)
- **Update Logic**: Allow `'driver'` role in the access check logic.

### 6. Navigation & Layout (`index.tsx`)
- **Sidebar**: Conditionally render sidebar items. Drivers only see:
    - Maintenance (Tickets)
    - Profile
    - Settings
    - Logout
- **Routing**:
    - Redirect drivers to `'maintenance'` tab by default.
    - Prevent access to restricted tabs.

### 7. Mobile Optimization (`views/TicketFormView.tsx`)
- **Touch Targets**: Increase size of buttons and inputs (min 44px height).
- **Camera Integration**: Ensure file input accepts `capture="environment"` for direct camera access on mobile.
- **Simplified Layout**:
    - Stack inputs vertically with more spacing.
    - Use larger font sizes for labels.
    - Make the "Upload" area prominent and easy to tap.

## Verification Plan

### Manual Verification
1.  **Database**: Run the SQL migration.
2.  **User Creation**: Create a driver user (`0812345678`).
3.  **Login**: Log in with phone number.
4.  **Mobile Experience**:
    - Use browser dev tools (Device Toolbar) to simulate a phone.
    - Verify the login page looks good on mobile.
    - Verify the ticket form is easy to use (large buttons, clear inputs).
    - Test file upload (simulated).
