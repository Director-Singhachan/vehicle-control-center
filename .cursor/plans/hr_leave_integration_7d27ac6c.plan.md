---
name: HR leave integration
overview: Integrate HumanSoft leave data into OmniFlow so HR and logistics can see who is on leave and avoid assigning them to delivery trips.
todos:
  - id: decide-humansoft-mode
    content: Decide HumanSoft integration mode (API, file import, or webhook) and confirm employee code mapping between systems.
    status: pending
  - id: schema-staff-leaves
    content: Design and migrate a new staff_leaves table in Supabase and regenerate TypeScript types.
    status: pending
  - id: implement-leave-import
    content: Implement a backend importer (Edge Function or handler) to sync approved leaves from HumanSoft into staff_leaves.
    status: pending
  - id: leave-service-layer
    content: Create leaveService utilities to fetch leave status by date/staff and integrate them into crew/vehicle-related services.
    status: pending
  - id: update-logistics-ui-leave
    content: Update trip creation and crew selection UIs to surface leave status and prevent or warn on assigning staff who are on leave.
    status: pending
  - id: add-hr-leave-views
    content: Add HR-facing views for daily leave overview and per-staff leave history under the บุคคล / HR section.
    status: pending
isProject: false
---

# HR Leave Integration with HumanSoft

## Goals

- Connect OmniFlow to HumanSoft leave data so the system always knows which staff are on leave for a given day.
- Surface leave status clearly in logistics flows (trip creation, crew assignment) to prevent assigning absent staff.
- Provide HR with a clear view of daily/periodic leaves using existing HR navigation (บุคคล / HR).

## Data & Schema

- **Review existing tables** in Supabase:
  - `profiles` (core employee account data: branch, department, position, phone).
  - `service_staff` (operational staff linked to vehicles; includes `status: 'active' | 'sick' | 'leave' | 'inactive'` and `user_id` to `profiles`).
  - `delivery_trip_crews` (who worked on which trip and in what role).
  - `commission_rates`, `commission_logs` (already track per-trip work and commissions).
- **Introduce a dedicated leave table** (Supabase migration in `supabase/migrations`):
  - Table `staff_leaves` (name can be adjusted):
    - `id` (uuid, PK)
    - `staff_id` (uuid, FK → `service_staff.id`)
    - `date_from`, `date_to` (date or timestamptz; use date for simplicity)
    - `leave_type` (text or enum: `sick`, `business`, `vacation`, `unpaid`, ...)
    - `source` (text: `humansoft`, `manual`)
    - `status` (text: `approved`, `pending`, `rejected` — primarily `approved` for trip blocking)
    - `notes` (text, nullable)
    - Audit fields: `created_at`, `created_by`, `updated_at`, `updated_by`.
  - Add minimal RLS to allow HR/admin roles to read/write; logistics can read-only.
  - Regenerate Supabase types via `npm run gen:types` so `types/database.ts` includes `staff_leaves`.

## HumanSoft Integration Strategy

- **Choose integration mode** (to be decided with the business):
  - **API pull** (preferred): OmniFlow calls HumanSoft REST API to fetch approved leaves either for a date range or by last updated timestamp.
  - **File import**: HR exports a daily/weekly leave file from HumanSoft (CSV/XLSX), then uploads into OmniFlow (similar UX to `ExcelImportView`).
  - **Webhook**: HumanSoft posts to an OmniFlow endpoint whenever a leave is created/approved (requires HumanSoft support).
- **Implement a backend importer** (Supabase Edge Function or serverless handler under `supabase/functions`):
  - Parse HumanSoft data and map to OmniFlow employees via a stable key (prefer `employee_code` from `profiles`/`service_staff`).
  - Upsert into `staff_leaves` (handle overlapping ranges and duplicate imports idempotently).
  - Log any rows that fail to map (e.g. unknown employee code) for HR to fix.
- **Schedule or trigger sync**:
  - For API or file import, run at least once daily before dispatch planning; optionally on-demand from an "Sync from HumanSoft" action in the HR section.

## Backend Services in OmniFlow

- **Create a leave service module** (e.g. `services/leaveService.ts`):
  - `getLeavesForDate(date, branch?)`: returns all approved leaves for a date, optionally filtered by branch.
  - `getLeaveStatusForStaff(staffIds, date)`: returns a map of `staff_id → { isOnLeave: boolean, leaveType, date_from, date_to }`.
  - `getLeavesForStaff(staffId, range)`: used for HR reporting and staff detail pages.
- **Integrate into crew/vehicle flows**:
  - In `crewService` / `deliveryTripService` (or a dedicated crew loader), when fetching available `service_staff` for a date, also load leave status for that date and attach an `is_on_leave_today` flag (plus optional metadata) to each staff object.
  - Ensure services that power `TripCrewSection`, `CrewAssignmentStep`, and `CrewAssignment` can consume these flags without changing their public API too drastically (e.g. extend existing `ServiceStaff`-like types via intersection).

## UI Changes – Logistics (Trip & Crew)

- **Trip creation / edit views** (e.g. `[views/DeliveryTripFormView.tsx](views/DeliveryTripFormView.tsx)`, `[components/trip/TripCrewSection.tsx](components/trip/TripCrewSection.tsx)`, `[components/crew/CrewAssignment.tsx](components/crew/CrewAssignment.tsx)`):
  - When listing available drivers/helpers, show a clear visual indicator when a person is on leave for the selected trip date:
    - Badge like **"ลางานวันนี้"** with a warning color.
    - Optional tooltip with `leave_type` and date range from `staff_leaves`.
  - **Blocking behavior** (configurable, but start conservative):
    - Default: staff on leave **cannot be selected** (disabled checkbox/button, with tooltip explaining why).
    - Advanced: allow override with a confirmation dialog for emergency cases (record an override reason for audit).
  - Add a small filter control above the list: "ซ่อนพนักงานที่ลางานวันนี้" to completely hide leave-on-date staff from suggestions when checked.
- **Trip crew detail view** (e.g. `[components/trip/TripCrewDetailSection.tsx](components/trip/TripCrewDetailSection.tsx)`):
  - If historical data shows someone was assigned to a trip while marked on leave, highlight with an icon or note (helps HR audit irregularities).

## UI Changes – HR Section

- **Daily leave overview** inside `บุคคล / HR`:
  - Add a subsection or simple filter in `[views/ServiceStaffManagementView.tsx](views/ServiceStaffManagementView.tsx)` or a new lightweight `StaffLeaveOverviewView`:
    - Controls: date picker (default today), branch filter (reuse existing branch logic), optional leave type filter.
    - List or table of staff on leave that day with: name, employee_code, branch, leave_type, date range.
    - Quick links to:
      - View that staff member’s vehicle/trip history (`StaffVehicleUsageView`).
      - Open their profile in `AdminStaffManagementView`.
- **Per-staff leave history**:
  - In `StaffVehicleUsageView` or a new staff details card, include a simple timeline or count of leaves over a selected period using `staff_leaves` (e.g. days of leave vs work days).

## Access Control & Roles

- **Visibility**:
  - HR + Admin: full read/write on `staff_leaves`, can trigger/schedule HumanSoft sync.
  - Logistics managers: read-only access for planning trips.
  - Drivers/Service staff: normally no direct leave UI in OmniFlow, since they use HumanSoft to request leave.
- **Mapping & consistency**:
  - Ensure `service_staff.employee_code` (and/or `profiles.employee_code`) is the canonical join key between HumanSoft and OmniFlow.
  - Optionally, provide a small admin tool (in HR section) to manually map/unmap staff records when employee codes mismatch.

## Testing & Monitoring

- **Unit/integration tests**:
  - For the leave importer (API or file parser): handle duplicate imports, overlapping ranges, and unknown staff.
  - For crew selection services: verify staff on leave are correctly flagged and excluded from assignment.
- **UI tests / manual scenarios**:
  - Scenario: staff A is on leave today → they do not appear / are disabled in trip crew selection for today but appear normally for future dates.
  - Scenario: multi-day leave (date_from/date_to) correctly affects all days in between.
- **Monitoring**:
  - Log failed imports from HumanSoft, with a simple report HR can review to fix data (e.g. missing/mismatched employee codes).

## Future Extensions

- Use `staff_leaves` + `delivery_trip_crews` + `commission_logs` to build richer HR analytics (e.g. correlation between absence and productivity).
- Expose leave summaries in management reports under `[views/ReportsView.tsx](views/ReportsView.tsx)`.
- Optionally push notifications (LINE/Telegram) to dispatchers when leave records change on the same day as planned trips.

