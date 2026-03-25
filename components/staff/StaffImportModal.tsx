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
    is_resigned?: boolean;
    resignation_date?: string | null;
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
    if (combined.includes('SD')) return 'SD';
    if (combined.includes('ASIA')) return 'Asia';
    return 'HQ';
}

export const StaffImportModal: React.FC<StaffImportModalProps> = ({ isOpen, onClose, onSuccess, existingStaff }) => {
    const { profile } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter and Sort states
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'skip'>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ProcessedRow | 'role' | 'branch' | 'action', direction: 'asc' | 'desc' } | null>(null);

    const stats = useMemo(() => {
        return {
            total: processedRows.length,
            create: processedRows.filter(r => r.action === 'create').length,
            update: processedRows.filter(r => r.action === 'update').length,
            resigned: processedRows.filter(r => r.is_resigned).length,
            error: processedRows.filter(r => r.error).length,
        };
    }, [processedRows]);

    const roles = useMemo(() => {
        const set = new Set<string>();
        processedRows.forEach(r => set.add(r.role));
        return Array.from(set).sort();
    }, [processedRows]);

    const filteredRows = useMemo(() => {
        let rows = [...processedRows];

        // Filtering
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            rows = rows.filter(r => 
                r.full_name.toLowerCase().includes(q) || 
                r.employee_code.toLowerCase().includes(q) ||
                (r.position || '').toLowerCase().includes(q)
            );
        }
        if (actionFilter === 'resigned') {
            rows = rows.filter(r => r.is_resigned);
        } else if (actionFilter !== 'all') {
            rows = rows.filter(r => r.action === actionFilter);
        }
        if (roleFilter !== 'all') {
            rows = rows.filter(r => r.role === roleFilter);
        }

        // Sorting
        if (sortConfig) {
            rows.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key] || '';
                const bVal = (b as any)[sortConfig.key] || '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return rows;
    }, [processedRows, searchQuery, actionFilter, roleFilter, sortConfig]);

    const toggleSort = (key: any) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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
                const sheetIndices = workbook.SheetNames.findIndex(n => n.includes('Simple'));
                const sheetName = sheetIndices !== -1 ? workbook.SheetNames[sheetIndices] : workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
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

                    let prefix = row[colMap['คำนำหน้า']]?.toString().trim() || null;
                    if (prefix && prefix.length > 3) {
                        prefix = prefix.substring(3);
                    }
                    const firstName = row[colMap['ชื่อจริง']]?.toString().trim() || '';
                    const lastName = row[colMap['นามสกุล']]?.toString().trim() || '';
                    const nickname = row[colMap['ชื่อเล่น']]?.toString().trim() || '';
                    const fullName = `${firstName} ${lastName}${nickname ? ` (${nickname})` : ''}`.trim();
                    const phone = row[colMap['เบอร์โทร']]?.toString().trim() || null;
                    
                    // Email logic: 
                    // 1. If contains 'domain' -> use {code}@staff.local
                    // 2. If empty -> null
                    // 3. Otherwise -> use the actual value
                    const emailRaw = row[colMap['Email']]?.toString().trim() || '';
                    let email: string | null = null;
                    if (emailRaw.toLowerCase().includes('domain')) {
                        email = `${code}@staff.local`;
                    } else if (emailRaw !== '') {
                        email = emailRaw;
                    }

                    const dept = row[colMap['ชื่อแผนก']]?.toString().trim() || null;
                    const pos = row[colMap['ชื่อตำแหน่ง']]?.toString().trim() || null;
                    const branchCode = row[colMap['รหัสสาขา']]?.toString().trim() || '';
                    const resignedStatus = row[colMap['สถานะลาออก']]?.toString().trim().toUpperCase();
                    const resignationDate = row[colMap['วันที่ลาออก']]?.toString().trim() || null;

                    const isResigned = resignedStatus === 'Y';

                    const role = inferRole(pos || '');
                    const branch = inferBranch(pos || '', branchCode);

                    const existing = staffMap.get(code) as StaffProfile | undefined;
                    let action: 'create' | 'update' | 'skip' = existing ? 'update' : 'create';
                    let changes: Record<string, { old: any, new: any }> = {};

                    if (existing) {
                        const checkVal = (old: any, val: any) => {
                            const o = (old || '').toString().trim();
                            const n = (val || '').toString().trim();
                            return o === n;
                        };

                        if (!checkVal(existing.full_name, fullName)) changes.full_name = { old: existing.full_name, new: fullName };
                        if (!checkVal(existing.name_prefix, prefix)) changes.name_prefix = { old: existing.name_prefix, new: prefix };
                        if (!checkVal(existing.role, role)) changes.role = { old: existing.role, new: role };
                        if (!checkVal(existing.branch, branch)) changes.branch = { old: existing.branch, new: branch };
                        if (!checkVal(existing.department, dept)) changes.department = { old: existing.department, new: dept };
                        if (!checkVal(existing.position, pos)) changes.position = { old: existing.position, new: pos };
                        if (!checkVal(existing.phone, phone)) changes.phone = { old: existing.phone, new: phone };
                        
                        // Only update email if it's NOT empty in Excel
                        if (email !== null && !checkVal(existing.email, email)) {
                            changes.email = { old: existing.email, new: email };
                        }
                        
                        // Check for resignation changes
                        if (isResigned && !existing.is_banned) {
                            changes.is_banned = { old: false, new: true };
                        }
                        if (resignationDate && existing.resignation_date !== resignationDate) {
                            changes.resignation_date = { old: existing.resignation_date, new: resignationDate };
                        }
                        
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
                        is_resigned: isResigned,
                        resignation_date: resignationDate,
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
        let failCount = 0;

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
                        is_banned: row.is_resigned,
                        resignation_date: row.resignation_date,
                    });
                } else if (row.action === 'update') {
                    const existing = existingStaff.find(s => s.employee_code === row.employee_code);
                    if (existing && row.changes) {
                        // สร้าง payload เฉพาะที่มีการเปลี่ยนแปลงจริงๆ
                        const updatePayload: any = {};
                        if (row.changes.full_name) updatePayload.full_name = row.full_name;
                        if (row.changes.name_prefix) updatePayload.name_prefix = row.name_prefix;
                        if (row.changes.role) updatePayload.role = row.role;
                        if (row.changes.branch) updatePayload.branch = row.branch;
                        if (row.changes.department) updatePayload.department = row.department;
                        if (row.changes.position) updatePayload.position = row.position;
                        if (row.changes.phone) updatePayload.phone = row.phone;
                        if (row.changes.email) updatePayload.email = row.email;
                        if (row.changes.is_banned) updatePayload.is_banned = row.is_resigned;
                        if (row.changes.resignation_date) updatePayload.resignation_date = row.resignation_date;

                        if (Object.keys(updatePayload).length > 0) {
                            await adminStaffService.updateProfile(existing.id, updatePayload);
                        }
                    }
                }
                successCount++;
            } catch (err: any) {
                failCount++;
                console.error(`Failed to ${row.action} ${row.employee_code}:`, err.message);
                // ในอนาคตอาจเพิ่มการแสดง error รายบรรทัด
            }
            setProgress(Math.round(((i + 1) / toProcess.length) * 100));
        }

        setImporting(false);
        if (failCount > 0) {
            alert(`นำเข้าเสร็จสิ้น: สำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ (ตรวจสอบ Console สำหรับรายละเอียด)`);
        }
        onSuccess();
        onClose();
    };

    const renderSortIcon = (key: any) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="จัดการการนำเข้าข้อมูลพนักงาน"
            size="large"
        >
            <div className="space-y-6">
                {!file ? (
                    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/30 dark:bg-slate-900/30 transition-all hover:border-enterprise-400 hover:bg-slate-50/50">
                        <div className="w-20 h-20 bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                            <Upload size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">อัปโหลดไฟล์ข้อมูลพนักงาน</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 text-center max-w-sm px-6">
                            รองรับไฟล์ <span className="font-bold">.xlsx (Sheet: Simple)</span><br />
                            ระบบจะเปรียบเทียบข้อมูลด้วยรหัสพนักงานเป็นหลัก
                        </p>
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            accept=".xlsx"
                            onChange={handleFileChange}
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={loading}
                            className="bg-enterprise-600 hover:bg-enterprise-700 text-white shadow-md px-8 py-2.5 rounded-xl transition-all active:scale-95"
                        >
                            {loading ? <LoadingSpinner size={20} className="mr-2" /> : <FileText size={20} className="mr-2" />}
                            เลือกไฟล์ Excel
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5 animate-in fade-in duration-500">
                        {/* Header Status Bar */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                    <FileText size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[300px]">{file.name}</span>
                                    <span className="text-[10px] text-slate-500 font-medium">ขนาด {(file.size / 1024).toFixed(1)} KB</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setProcessedRows([]); }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-xs px-4">
                                เปลี่ยนไฟล์
                            </Button>
                        </div>

                        {loading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-5">
                                <div className="relative">
                                    <LoadingSpinner size={48} className="text-enterprise-600" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <XLSX_ICON className="w-5 h-5 text-green-600 animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">กำลังประมวลผลข้อมูล...</p>
                                    <p className="text-[11px] text-slate-400 mt-1 italic">ใช้เวลาเพียงครู่เดียวเพื่อจัดเตรียมรายการพนักงาน</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Stats & Integrated Filters Ribbon */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">รายการทั้งหมด</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                                        </div>
                                        <div className="p-4 bg-green-50/50 dark:bg-green-900/20 border border-green-100/50 dark:border-green-900/30 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase mb-1">สร้างพนักงานใหม่</p>
                                            <p className="text-2xl font-black text-green-600">{stats.create}</p>
                                        </div>
                                        <div className="p-4 bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100/50 dark:border-orange-900/30 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase mb-1">อัปเดตข้อมูลเดิม</p>
                                            <p className="text-2xl font-black text-orange-600">{stats.update}</p>
                                        </div>
                                        <div className="p-4 bg-red-50/50 dark:bg-red-900/20 border border-red-100/50 dark:border-red-900/30 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase mb-1">บัญชีที่ลาออก</p>
                                            <p className="text-2xl font-black text-red-600">{stats.resigned}</p>
                                        </div>
                                        <div className="col-span-2 lg:col-span-1 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center opacity-70">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">ไม่มีการแก้ไข</p>
                                            <p className="text-2xl font-black text-slate-500">{stats.total - stats.create - stats.update - stats.resigned}</p>
                                        </div>
                                    </div>

                                    {/* Action Bar: Filters & Search */}
                                    <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div className="relative flex-1 min-w-[200px]">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="ค้นหาชื่อ, รหัส, หรือตำแหน่ง..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 text-sm border-none bg-white dark:bg-slate-800 rounded-xl shadow-sm focus:ring-2 focus:ring-enterprise-500/30 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <select
                                                value={actionFilter}
                                                onChange={(e) => setActionFilter(e.target.value as any)}
                                                className="px-4 py-2 text-xs font-bold border-none bg-white dark:bg-slate-800 rounded-xl shadow-sm focus:ring-2 focus:ring-enterprise-500/30 focus:outline-none"
                                            >
                                                <option value="all">สถานะทั้งหมด</option>
                                                <option value="create">(+) เพิ่มใหม่</option>
                                                <option value="update">(≈) อัปเดต</option>
                                                <option value="resigned">(✖) ลาออก</option>
                                                <option value="skip">(•) ข้าม</option>
                                            </select>
                                            <select
                                                value={roleFilter}
                                                onChange={(e) => setRoleFilter(e.target.value)}
                                                className="px-4 py-2 text-xs font-bold border-none bg-white dark:bg-slate-800 rounded-xl shadow-sm focus:ring-2 focus:ring-enterprise-500/30 focus:outline-none"
                                            >
                                                <option value="all">บทบาททั้งหมด</option>
                                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Table Area */}
                                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950">
                                    <div className="max-h-[380px] overflow-auto custom-scrollbar">
                                        <table className="w-full text-left border-separate border-spacing-0">
                                            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                                                <tr className="border-b dark:border-slate-800">
                                                    <th className="px-6 py-4 cursor-pointer hover:text-enterprise-600 transition-colors" onClick={() => toggleSort('employee_code')}>
                                                        รหัส {renderSortIcon('employee_code')}
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:text-enterprise-600 transition-colors" onClick={() => toggleSort('full_name')}>
                                                        พนักงาน {renderSortIcon('full_name')}
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:text-enterprise-600 transition-colors" onClick={() => toggleSort('role')}>
                                                        Role / สาขา {renderSortIcon('role')}
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:text-enterprise-600 transition-colors" onClick={() => toggleSort('action')}>
                                                        สถานะ {renderSortIcon('action')}
                                                    </th>
                                                    <th className="px-6 py-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm divide-y divide-slate-50 dark:divide-slate-900">
                                                {filteredRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-16 text-center text-slate-400 italic">
                                                            <Search size={32} className="mx-auto mb-3 opacity-20" />
                                                            ไม่พบรายการที่ต้องการค้นหา
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredRows.map((row, idx) => {
                                                        const isExpanded = expandedRow === idx;
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <tr 
                                                                    onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                                                    className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all ${isExpanded ? 'bg-slate-50/50 dark:bg-blue-900/10' : ''} ${row.action === 'skip' ? 'grayscale opacity-60' : ''}`}
                                                                >
                                                                    <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-500">{row.employee_code}</td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                                                                                {row.full_name.charAt(0)}
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                                                                    {row.name_prefix} {row.full_name}
                                                                                </div>
                                                                                <div className="text-[10px] text-slate-400 font-medium">{row.position || 'ไม่มีตำแหน่ง'}</div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex flex-col gap-1">
                                                                            <Badge variant="info" className="text-[10px] px-2 py-0 w-fit font-bold rounded-md bg-blue-50/50 text-blue-600 border border-blue-100/50">{row.role}</Badge>
                                                                            <span className="text-[10px] text-slate-400 font-medium px-1">{row.branch}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        {row.action === 'create' && <Badge variant="success" className="px-3 py-1 text-[10px] font-black rounded-xl">เพิ่มใหม่</Badge>}
                                                                        {row.action === 'update' && (
                                                                            <div className="flex flex-col gap-1">
                                                                                <Badge variant="warning" className="px-3 py-1 text-[10px] font-black rounded-xl">อัปเดต</Badge>
                                                                                <span className="text-[9px] text-orange-400 font-bold px-1 select-none">แก้ {Object.keys(row.changes || {}).length} รายการ</span>
                                                                            </div>
                                                                        )}
                                                                        {row.action === 'skip' && <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">ข้าม</span>}
                                                                        {row.is_resigned && (
                                                                            <Badge variant="error" className="ml-1 px-3 py-1 text-[10px] font-black rounded-xl">ลาออก</Badge>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <div className="p-1.5 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 shadow-sm transition-all border border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-700">
                                                                            <ArrowRight size={14} className={`text-slate-300 transition-all ${isExpanded ? 'rotate-90 text-blue-500' : ''}`} />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr className="bg-slate-50/80 dark:bg-slate-900/40">
                                                                        <td colSpan={5} className="p-0 border-t border-slate-100 dark:border-slate-800">
                                                                            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-top-1 duration-300">
                                                                                {/* Full Profile Details Card */}
                                                                                <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                                                                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                                        <Info size={14} className="text-blue-500" /> ข้อมูลทั้งหมดที่จะนำเข้า
                                                                                    </h5>
                                                                                    <div className="space-y-3">
                                                                                        {[
                                                                                            { label: 'รหัสพนักงาน', val: row.employee_code, mono: true },
                                                                                            { label: 'พนักงาน', val: (row.name_prefix || '') + row.full_name },
                                                                                            { label: 'ตำแหน่ง', val: row.position },
                                                                                            { label: 'แผนก', val: row.department },
                                                                                            { label: 'สาขา', val: row.branch },
                                                                                            { label: 'บทบาท', val: row.role, highlight: true },
                                                                                            { label: 'อีเมล', val: row.email || '(ใช้รหัสพนักงาน@staff.local)' },
                                                                                            { label: 'เบอร์โทร', val: row.phone },
                                                                                            { label: 'ลาออก/วันที่มีผล', val: row.is_resigned ? `ใช่ (${row.resignation_date || 'ไม่ระบุวัน'})` : 'ไม่ใช่', highlight: row.is_resigned },
                                                                                        ].map((item, i) => (
                                                                                            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                                                                                <span className="text-[11px] text-slate-400 font-bold">{item.label}</span>
                                                                                                <span className={`text-xs font-bold ${item.mono ? 'font-mono' : ''} ${item.highlight ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                                                    {item.val || '-'}
                                                                                                </span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Detailed Comparison View */}
                                                                                <div className="lg:col-span-7">
                                                                                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                                        <AlertCircle size={14} className={row.action === 'update' ? 'text-orange-500' : 'text-green-500'} />
                                                                                        {row.action === 'update' ? 'รายละเอียดสิ่งที่เปลี่ยนแปลง' : 'ข้อมูลพนักงานใหม่'}
                                                                                    </h5>
                                                                                    
                                                                                    {row.action === 'update' && row.changes ? (
                                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                            {Object.entries(row.changes).map(([key, diff]) => {
                                                                                                const d = diff as { old: any, new: any };
                                                                                                const labels: Record<string, string> = {
                                                                                                    full_name: 'ชื่อ-นามสกุล',
                                                                                                    name_prefix: 'คำนำหน้า',
                                                                                                    role: 'บทบาท',
                                                                                                    branch: 'สาขา',
                                                                                                    department: 'แผนก',
                                                                                                    position: 'ตำแหน่ง',
                                                                                                    phone: 'เบอร์โทร',
                                                                                                    email: 'อีเมล'
                                                                                                };
                                                                                                return (
                                                                                                    <div key={key} className="group/diff p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-2 transition-all hover:ring-2 hover:ring-blue-500/10 overflow-hidden">
                                                                                                        <span className="text-[10px] font-black text-slate-300 uppercase shrink-0">{labels[key] || key}</span>
                                                                                                        <div className="flex flex-col gap-2 relative">
                                                                                                            <div 
                                                                                                                className="text-[10px] text-slate-400 line-through font-medium bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg break-words transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                                                                title={`จาก: ${d.old || '(ไม่มี)'}`}
                                                                                                            >
                                                                                                                {d.old || '(ไม่มี)'}
                                                                                                            </div>
                                                                                                            <div className="absolute left-1/2 -top-1.5 -translate-x-1/2 z-10 w-6 h-6 bg-white dark:bg-slate-800 text-blue-500 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 pointer-events-none">
                                                                                                                <ArrowRight size={10} className="rotate-90" />
                                                                                                            </div>
                                                                                                            <div 
                                                                                                                className="text-xs text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-900/20 px-3 py-2 rounded-lg break-words border border-blue-100/30 dark:border-blue-800/30 transition-all hover:bg-blue-100/50 dark:hover:bg-blue-900/40 shadow-sm"
                                                                                                                title={`เป็น: ${d.new || '(ไม่มี)'}`}
                                                                                                            >
                                                                                                                {d.new || '(ไม่มี)'}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="p-12 bg-green-50/30 dark:bg-green-900/10 border-2 border-dashed border-green-200/50 dark:border-green-800/30 rounded-3xl flex flex-col items-center justify-center text-center">
                                                                                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-green-200">
                                                                                                <CheckCircle size={32} />
                                                                                            </div>
                                                                                            <h6 className="text-green-800 dark:text-green-300 font-bold">พร้อมสำหรับการสร้างพนักงานใหม่</h6>
                                                                                            <p className="text-[11px] text-green-600 mt-1">ข้อมูลถูกจัดเตรียมไว้เรียบร้อยแล้ว กดยืนยันที่ปุ่มด้านล่างเพื่อดำเนินการ</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {/* Scroll Indicator */}
                                    <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <p className="text-[10px] text-slate-400 font-bold">
                                            แสดง {filteredRows.length} จาก {processedRows.length} รายการ
                                        </p>
                                        <div className="flex gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-slate-300 animate-pulse"></div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300 animate-pulse delay-75"></div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300 animate-pulse delay-150"></div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={onClose} disabled={importing} className="font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                    ยกเลิก
                </Button>
                {file && !loading && (
                    <Button 
                        onClick={handleImport} 
                        disabled={importing || (stats.create === 0 && stats.update === 0)}
                        className="min-w-[180px] bg-enterprise-600 hover:bg-enterprise-700 text-white font-black py-2.5 rounded-xl shadow-lg shadow-enterprise-500/20 active:scale-95 transition-all"
                    >
                        {importing ? (
                            <>
                                <LoadingSpinner size={18} className="mr-2" />
                                กำลังดำเนินการ {progress}%
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} className="mr-2" />
                                ยืนยันการนำเข้าข้อมูล
                            </>
                        )}
                    </Button>
                )}
            </div>
        </Modal>
    );
};

/* --- Local Helper Icons --- */
const XLSX_ICON = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7.5L14.5 2zM14 8V3.5L18.5 8H14zM16 19h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V9h8v2z" />
    </svg>
);
