import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Save, X, Search, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { adminStaffService, type StaffProfile } from '../../services/adminStaffService';
import type { AppRole } from '../../types/database';

interface StaffImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingStaff: StaffProfile[];
}

interface ProcessedRow {
    employee_code: string;
    full_name: string;
    name_prefix: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    branch: string | null;
    role: AppRole;
    action: 'create' | 'update' | 'skip';
    changes?: Record<string, { old: any, new: any }>;
    error?: string;
    rawData: any;
}

// Role Mapping Table based on Position Name
const ROLE_MAP: Record<string, AppRole> = {
    'driver': 'driver',
    'พนักงานขับรถ': 'driver',
    'truck': 'driver',
    'trailer': 'driver',
    'forklift': 'driver',
    'van sale': 'driver', // Default to driver as per logic
    'accounting': 'accounting',
    'finance': 'accounting',
    'บัญชี': 'accounting',
    'การเงิน': 'accounting',
    'purchasing': 'accounting',
    'จัดซื้อ': 'accounting',
    'hr': 'hr',
    'human resource': 'hr',
    'บุคคล': 'hr',
    'warehouse': 'warehouse',
    'logistic': 'warehouse',
    'คลังสินค้า': 'warehouse',
    'checker': 'warehouse',
    'เช็คเกอร์': 'warehouse',
    'service': 'service_staff',
    'พนักงานบริการ': 'service_staff',
    'supporter 2': 'service_staff',
    'retail': 'sales',
    'wholesale': 'sales',
    'ขายปลีก': 'sales',
    'ขายส่ง': 'sales',
    'van sale assistant': 'sales',
    'managing director': 'executive',
    'กรรมการบริหาร': 'executive',
    'board of director': 'executive',
    'maintenance': 'inspector',
    'ซ่อมบำรุง': 'inspector',
};

function inferRole(position: string): AppRole {
    const p = position.toLowerCase();
    for (const [key, role] of Object.entries(ROLE_MAP)) {
        if (p.includes(key)) return role;
    }
    return 'user'; // Default role
}

function inferBranch(position: string, branchCode: string): string {
    const combined = `${position} ${branchCode}`.toUpperCase();
    if (combined.includes('SD')) return 'สาขาสอยดาว';
    if (combined.includes('ASIA')) return 'Asia';
    return 'สาขาหลัก';
}

export const StaffImportModal: React.FC<StaffImportModalProps> = ({ isOpen, onClose, onSuccess, existingStaff }) => {
    const { profile } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stats = useMemo(() => {
        return {
            total: processedRows.length,
            create: processedRows.filter(r => r.action === 'create').length,
            update: processedRows.filter(r => r.action === 'update').length,
            error: processedRows.filter(r => r.error).length,
        };
    }, [processedRows]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            parseFile(f);
        }
    };

    const parseFile = async (f: File) => {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets['Simple'] || workbook.Sheets[workbook.SheetNames[0]];
                
                // transform logic per user request:
                // Skip rows until headers are found. The Power Query skips and promotes twice.
                // Usually this means headers might be on row 2 or 3.
                // We'll search for 'รหัสพนักงาน' to find the header row.
                const rawJson = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(20, rawJson.length); i++) {
                    if (rawJson[i].includes('รหัสพนักงาน')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error('ไม่พบคอลัมน์ "รหัสพนักงาน" ในไฟล์');
                }

                const headers = rawJson[headerRowIndex].map(h => (h || '').toString().trim());
                const rows = rawJson.slice(headerRowIndex + 1);

                const colMap: Record<string, number> = {};
                headers.forEach((h, idx) => { colMap[h] = idx; });

                const results: ProcessedRow[] = [];
                const staffMap = new Map(existingStaff.map(s => [s.employee_code, s]));

                for (const row of rows) {
                    const code = row[colMap['รหัสพนักงาน']]?.toString().trim();
                    if (!code) continue;

                    const prefix = row[colMap['คำนำหน้า']]?.toString().trim() || null;
                    const firstName = row[colMap['ชื่อจริง']]?.toString().trim() || '';
                    const lastName = row[colMap['นามสกุล']]?.toString().trim() || '';
                    const fullName = `${firstName} ${lastName}`.trim();
                    const phone = row[colMap['เบอร์โทร']]?.toString().trim() || null;
                    const email = row[colMap['Email']]?.toString().trim() || null;
                    const dept = row[colMap['ชื่อแผนก']]?.toString().trim() || null;
                    const pos = row[colMap['ชื่อตำแหน่ง']]?.toString().trim() || null;
                    const branchCode = row[colMap['รหัสสาขา']]?.toString().trim() || '';

                    const role = inferRole(pos || '');
                    const branch = inferBranch(pos || '', branchCode);

                    const existing = staffMap.get(code) as StaffProfile | undefined;
                    let action: 'create' | 'update' | 'skip' = existing ? 'update' : 'create';
                    let changes: Record<string, { old: any, new: any }> = {};

                    if (existing) {
                        if (existing.full_name !== fullName) changes.full_name = { old: existing.full_name, new: fullName };
                        if (existing.name_prefix !== prefix) changes.name_prefix = { old: existing.name_prefix, new: prefix };
                        if (existing.role !== role) changes.role = { old: existing.role, new: role };
                        if (existing.branch !== branch) changes.branch = { old: existing.branch, new: branch };
                        if (existing.department !== dept) changes.department = { old: existing.department, new: dept };
                        if (existing.position !== pos) changes.position = { old: existing.position, new: pos };
                        if (existing.phone !== phone) changes.phone = { old: existing.phone, new: phone };
                        
                        // Only update if there are actual changes
                        if (Object.keys(changes).length === 0) {
                            action = 'skip';
                        }
                    }

                    results.push({
                        employee_code: code,
                        full_name: fullName,
                        name_prefix: prefix,
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        phone,
                        department: dept,
                        position: pos,
                        branch,
                        role,
                        action,
                        changes: action === 'update' ? changes : undefined,
                        rawData: row
                    });
                }

                setProcessedRows(results);
            } catch (err: any) {
                alert(err.message);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(f);
    };

    const handleImport = async () => {
        setImporting(true);
        setProgress(0);
        const toProcess = processedRows.filter(r => r.action !== 'skip');
        let successCount = 0;

        for (let i = 0; i < toProcess.length; i++) {
            const row = toProcess[i];
            try {
                if (row.action === 'create') {
                    await adminStaffService.createUser({
                        employee_code: row.employee_code,
                        full_name: row.full_name,
                        name_prefix: row.name_prefix || undefined,
                        role: row.role,
                        branch: row.branch || undefined,
                        department: row.department || undefined,
                        position: row.position || undefined,
                        phone: row.phone || undefined,
                        email: row.email || undefined,
                        password: row.employee_code, // Default password as employee code
                    });
                } else if (row.action === 'update') {
                    const existing = existingStaff.find(s => s.employee_code === row.employee_code);
                    if (existing) {
                        await adminStaffService.updateProfile(existing.id, {
                            full_name: row.full_name,
                            name_prefix: row.name_prefix,
                            role: row.role,
                            branch: row.branch || undefined,
                            department: row.department || undefined,
                            position: row.position || undefined,
                            phone: row.phone || undefined,
                        });
                    }
                }
                successCount++;
            } catch (err: any) {
                console.error(`Failed to ${row.action} ${row.employee_code}:`, err.message);
            }
            setProgress(Math.round(((i + 1) / toProcess.length) * 100));
        }

        setImporting(false);
        onSuccess();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="นำเข้าพนักงานจากไฟล์ Excel"
            size="large"
        >
            <div className="space-y-6">
                {!file ? (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
                            <Upload size={32} />
                        </div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">ลากไฟล์วางที่นี่ หรือคลิกเพื่อค้นหา</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-sm">
                            รองรับไฟล์ .xlsx จากระบบพนักงาน (Sheet: Simple)<br />
                            รหัสพนักงานจะถูกใช้เป็นกุญแจหลักในการเปรียบเทียบข้อมูล
                        </p>
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            accept=".xlsx"
                            onChange={handleFileChange}
                        />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                            {loading ? <LoadingSpinner size={16} className="mr-2" /> : <FileText size={16} className="mr-2" />}
                            เลือกไฟล์ Excel
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{file.name}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">ขนาด {(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setProcessedRows([]); }}>
                                เปลี่ยนไฟล์
                            </Button>
                        </div>

                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <LoadingSpinner size={32} />
                                <p className="text-sm text-slate-500 animate-pulse">กำลังประมวลผลข้อมูลในไฟล์...</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="p-3 bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30">
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">ทั้งหมด</p>
                                        <p className="text-xl font-bold">{stats.total}</p>
                                    </Card>
                                    <Card className="p-3 bg-green-50/50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30">
                                        <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase">สร้างใหม่</p>
                                        <p className="text-xl font-bold text-green-600">{stats.create}</p>
                                    </Card>
                                    <Card className="p-3 bg-orange-50/50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30">
                                        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase">อัปเดต</p>
                                        <p className="text-xl font-bold text-orange-600">{stats.update}</p>
                                    </Card>
                                </div>

                                <div className="max-h-[400px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500">
                                            <tr>
                                                <th className="px-4 py-2">รหัส</th>
                                                <th className="px-4 py-2">ชื่อ-นามสกุล</th>
                                                <th className="px-4 py-2">Role/สาขา</th>
                                                <th className="px-4 py-2">การดำเนินการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                                            {processedRows.map((row, idx) => (
                                                <tr key={idx} className={row.action === 'skip' ? 'opacity-40' : ''}>
                                                    <td className="px-4 py-3 font-mono text-xs">{row.employee_code}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-slate-900 dark:text-white">
                                                            {row.name_prefix} {row.full_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">{row.position}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="info" className="text-[10px] w-fit">{row.role}</Badge>
                                                            <span className="text-[10px] text-slate-500">{row.branch}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {row.action === 'create' && <Badge variant="success">เพิ่มใหม่</Badge>}
                                                        {row.action === 'update' && (
                                                            <div className="space-y-1">
                                                                <Badge variant="warning">อัปเดต</Badge>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {Object.keys(row.changes || {}).length} ฟิลด์เปลี่ยน
                                                                </div>
                                                            </div>
                                                        )}
                                                        {row.action === 'skip' && <span className="text-xs text-slate-400">ไม่มีอะไรเปลี่ยนแปลง</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={onClose} disabled={importing}>ยกเลิก</Button>
                {file && !loading && (
                    <Button 
                        onClick={handleImport} 
                        disabled={importing || (stats.create === 0 && stats.update === 0)}
                        className="min-w-[120px]"
                    >
                        {importing ? (
                            <>
                                <LoadingSpinner size={16} className="mr-2" />
                                {progress}%
                            </>
                        ) : (
                            <>
                                <Save size={16} className="mr-2" />
                                ยืนยันนำเข้า {stats.create + stats.update} รายการ
                            </>
                        )}
                    </Button>
                )}
            </div>
        </Modal>
    );
};
