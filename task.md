# Task: Implement Driver Role and Mobile Optimization

- [x] **Database & Types** <!-- id: 0 -->
    - [x] Create SQL migration `sql/20251206000000_add_driver_role.sql` <!-- id: 1 -->
    - [x] Update `types/database.ts` to include 'driver' role <!-- id: 2 -->
- [x] **Authentication & Login** <!-- id: 3 -->
    - [x] Update `stores/authStore.ts` and `hooks/useAuth.ts` with `isDriver` logic <!-- id: 4 -->
    - [x] Update `views/LoginView.tsx` for "Phone as Username" login <!-- id: 5 -->
- [x] **Access Control & Navigation** <!-- id: 6 -->
    - [x] Update `components/ProtectedRoute.tsx` to allow drivers <!-- id: 7 -->
    - [x] Update `index.tsx` to restrict sidebar and redirect drivers to Maintenance <!-- id: 8 -->
- [x] **Mobile Optimization** <!-- id: 9 -->
    - [x] Update `views/TicketFormView.tsx` for mobile-friendly UI and camera access <!-- id: 10 -->
- [ ] **Verification** <!-- id: 11 -->
    - [ ] Verify database migration <!-- id: 12 -->
    - [ ] Verify login flow and redirects <!-- id: 13 -->
    - [ ] Verify mobile UI <!-- id: 14 -->
