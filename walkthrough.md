# Vehicle Repair Request Form Implementation

I have implemented the vehicle repair request form with the following features:

## Features

1.  **File Upload**: Users can now upload images and videos to attach to the repair ticket.
    - Supports multiple files.
    - Validates file size (max 10MB).
    - Shows previews of selected files.
    - Allows removing selected files before upload.
    - Uploads files to Supabase Storage.

2.  **Searchable Vehicle Selection**:
    - Replaced the standard dropdown with a searchable combobox.
    - Users can type to filter vehicles by plate, make, or model.
    - Shows vehicle details (plate, make, model) in the dropdown.

3.  **Predefined Repair Types**:
    - Replaced the text input with a dropdown menu.
    - Includes common repair types:
        - เปลี่ยนถ่ายน้ำมันเครื่อง
        - ยางและช่วงล่าง
        - ระบบเบรก
        - แบตเตอรี่และระบบไฟ
        - เครื่องยนต์
        - ระบบแอร์
        - ตัวถังและสี
        - กระจกและอุปกรณ์ภายนอก
        - อุปกรณ์ภายในห้องโดยสาร
        - ตรวจเช็คระยะ
        - อื่นๆ

## Files Modified

-   `views/TicketFormView.tsx`: Updated the form UI and logic.
-   `services/storageService.ts`: Created a new service to handle file uploads.

## Verification

-   **File Upload**: Verified that files can be selected, previewed, and removed. The upload logic uses `storageService` to upload to Supabase.
-   **Vehicle Search**: Verified that typing in the vehicle input filters the list and selecting a vehicle updates the form state.
-   **Repair Types**: Verified that the dropdown shows the correct options and updates the form state.
