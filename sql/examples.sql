-- SQL Examples for Vehicle Control Center
-- ไฟล์ตัวอย่าง SQL สำหรับการพัฒนา

-- ============================================
-- ตัวอย่าง: สร้างตารางข้อมูลยานพาหนะ
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_id VARCHAR(50) UNIQUE NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50),
    brand VARCHAR(50),
    model VARCHAR(50),
    year INT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- ตัวอย่าง: สร้างตารางข้อมูลการใช้งาน
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_id VARCHAR(50) NOT NULL,
    driver_id VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    distance_km DECIMAL(10, 2),
    fuel_consumption DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
);

-- ============================================
-- ตัวอย่าง: Query ข้อมูลยานพาหนะทั้งหมด
-- ============================================
SELECT 
    v.vehicle_id,
    v.license_plate,
    v.vehicle_type,
    v.brand,
    v.model,
    v.status,
    COUNT(u.id) as total_usage_count,
    SUM(u.distance_km) as total_distance
FROM vehicles v
LEFT JOIN vehicle_usage u ON v.vehicle_id = u.vehicle_id
GROUP BY v.vehicle_id
ORDER BY v.created_at DESC;

-- ============================================
-- ตัวอย่าง: Query สถิติการใช้งานรายเดือน
-- ============================================
SELECT 
    DATE_FORMAT(start_time, '%Y-%m') as month,
    COUNT(*) as usage_count,
    SUM(distance_km) as total_distance,
    AVG(distance_km) as avg_distance,
    SUM(fuel_consumption) as total_fuel
FROM vehicle_usage
WHERE start_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(start_time, '%Y-%m')
ORDER BY month DESC;

-- ============================================
-- ตัวอย่าง: Query ยานพาหนะที่ใช้งานบ่อยที่สุด
-- ============================================
SELECT 
    v.vehicle_id,
    v.license_plate,
    COUNT(u.id) as usage_count,
    SUM(u.distance_km) as total_distance
FROM vehicles v
INNER JOIN vehicle_usage u ON v.vehicle_id = u.vehicle_id
WHERE u.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY v.vehicle_id, v.license_plate
ORDER BY usage_count DESC
LIMIT 10;

