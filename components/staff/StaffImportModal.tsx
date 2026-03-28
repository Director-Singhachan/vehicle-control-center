import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Save, X, Search, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { adminStaffService, type StaffProfile } from '../../services/adminStaffService';
import type { AppRole } from '../../types/database';
import {
  staffColumnIndex,
  STAFF_EMAIL_HEADER_CANDIDATES,
} from '../../utils/staffExcelHeaders';

export interface StaffImportBatchResult {
    success: number;
    failed: number;
    errors: string[];
    total: number;
}

interface StaffImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingStaff: StaffProfile[];
    /** สรุปหลังนำเข้า (ใช้แสดง toast — ก่อนหน้านี้แถวที่ error ถูกกลืนเงียบ) */
    onImportBatchComplete?: (result: StaffImportBatchResult) => void;
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
    selected: boolean;
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

export const StaffImportModal: React.FC<StaffImportModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    existingStaff,
    onImportBatchComplete,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [missingEmailColumn, setMissingEmailColumn] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter and Sort states
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'skip' | 'resigned'>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ProcessedRow | 'role' | 'branch' | 'action', direction: 'asc' | 'desc' } | null>(null);

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

    const stats = useMemo(() => {
        const create = processedRows.filter(r => r.action === 'create').length;
        const update = processedRows.filter(r => r.action === 'update').length;
        const selected = processedRows.filter(r => r.selected && r.action !== 'skip').length;
        
        return {
            total: processedRows.length,
            create,
            update,
            resigned: processedRows.filter(r => r.is_resigned).length,
            error: processedRows.filter(r => r.error).length,
            selected
        };
    }, [processedRows]);

    const allSelected = useMemo(() => {
        const selectable = filteredRows.filter(r => r.action !== 'skip');
        return selectable.length > 0 && selectable.every(r => r.selected);
    }, [filteredRows]);

    const toggleAll = () => {
        const targetValue = !allSelected;
        const filteredCodes = new Set(filteredRows.map(r => r.employee_code));
        setProcessedRows(prev => prev.map(r => 
            (filteredCodes.has(r.employee_code) && r.action !== 'skip') 
                ? { ...r, selected: targetValue } 
                : r
        ));
    };

    const toggleRow = (code: string) => {
        setProcessedRows(prev => prev.map(r => 
            r.employee_code === code ? { ...r, selected: !r.selected } : r
        ));
    };

    const roles = useMemo(() => {
        const set = new Set<string>();
        processedRows.forEach(r => set.add(r.role));
        return Array.from(set).sort();
    }, [processedRows]);

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
            setParseError(null);
            setMissingEmailColumn(false);
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
                headers.forEach((h, idx) => { 
                    const header = h.toLowerCase();
                    if (header === 'รหัสพนักงาน') colMap['code'] = idx;
                    else if (header === 'คำนำหน้า') colMap['prefix'] = idx;
                    else if (header === 'ชื่อจริง') colMap['firstName'] = idx;
                    else if (header === 'นามสกุล') colMap['lastName'] = idx;
                    else if (header === 'ชื่อเล่น') colMap['nickname'] = idx;
                    else if (header === 'เบอร์โทร' || header === 'phone') colMap['phone'] = idx;
                    else if (
                        header === 'email' ||
                        header === 'e-mail' ||
                        header === 'อีเมล' ||
                        header === 'อีเมล์'
                    ) {
                        colMap['email'] = idx;
                    }
                    else if (header === 'ชื่อแผนก' || header === 'แผนก') colMap['dept'] = idx;
                    else if (header === 'ชื่อตำแหน่ง' || header === 'ตำแหน่ง') colMap['pos'] = idx;
                    else if (header === 'รหัสสาขา' || header === 'สาขา') colMap['branch'] = idx;
                    else if (header === 'สถานะลาออก') colMap['resignedStatus'] = idx;
                    else if (header === 'วันที่ลาออก') colMap['resignationDate'] = idx;
                    
                    // Keep original for fallback
                    colMap[h] = idx; 
                });

                const emailCol = staffColumnIndex(colMap, STAFF_EMAIL_HEADER_CANDIDATES);
                setMissingEmailColumn(emailCol === undefined);

                const results: ProcessedRow[] = [];
                const staffMap = new Map(existingStaff.map(s => [s.employee_code, s]));

                for (const row of rows) {
                    const code = row[colMap['code'] || colMap['รหัสพนักงาน']]?.toString().trim();
                    if (!code) continue;

                    let prefix = row[colMap['prefix'] || colMap['คำนำหน้า']]?.toString().trim() || null;
                    if (prefix && prefix.length > 3) {
                        prefix = prefix.substring(3);
                    }
                    const firstName = row[colMap['firstName'] || colMap['ชื่อจริง']]?.toString().trim() || '';
                    const lastName = row[colMap['lastName'] || colMap['นามสกุล']]?.toString().trim() || '';
                    const nickname = row[colMap['nickname'] || colMap['ชื่อเล่น']]?.toString().trim() || '';
                    const fullName = `${firstName} ${lastName}${nickname ? ` (${nickname})` : ''}`.trim();
                    const phone = row[colMap['phone'] || colMap['เบอร์โทร']]?.toString().trim() || null;

                    let email: string | null = null;
                    if (emailCol !== undefined) {
                        const emailRaw = row[emailCol]?.toString().trim() || '';
                        if (emailRaw.toLowerCase().includes('domain')) {
                            email = `${code}@staff.local`;
                        } else if (emailRaw !== '') {
                            email = emailRaw;
                        }
                    }

                    const dept = row[colMap['dept'] || colMap['ชื่อแผนก']]?.toString().trim() || null;
                    const pos = row[colMap['pos'] || colMap['ชื่อตำแหน่ง']]?.toString().trim() || null;
                    const branchCode = row[colMap['branch'] || colMap['รหัสสาขา']]?.toString().trim() || '';
                    const resignedStatus = row[colMap['resignedStatus'] || colMap['สถานะลาออก']]?.toString().trim().toUpperCase();
                    const resignationDate = row[colMap['resignationDate'] || colMap['วันที่ลาออก']]?.toString().trim() || null;

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
                        
                        if (email !== null && !checkVal(existing.email, email)) {
                            changes.email = { old: existing.email, new: email };
                        }
                        
                        if (isResigned && !existing.is_banned) {
                            changes.is_banned = { old: false, new: true };
                        }
                        if (resignationDate && existing.resignation_date !== resignationDate) {
                            changes.resignation_date = { old: existing.resignation_date, new: resignationDate };
                        }
                        
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
                        selected: action !== 'skip',
                        is_resigned: isResigned,
                        resignation_date: resignationDate,
                        changes: action === 'update' ? changes : undefined,
                        rawData: row
                    });
                }

                setProcessedRows(results);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ';
                setParseError(message);
                setProcessedRows([]);
                setMissingEmailColumn(false);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(f);
    };

    const handleImport = async () => {
        const toProcess = processedRows.filter(r => r.selected && r.action !== 'skip');
        if (toProcess.length === 0) return;

        setImporting(true);
        setProgress(0);
        let successCount = 0;
        const rowErrors: string[] = [];

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
                        password: row.employee_code,
                        is_banned: row.is_resigned,
                        resignation_date: row.resignation_date,
                    });
                } else if (row.action === 'update') {
                    const existing = existingStaff.find(s => s.employee_code === row.employee_code);
                    if (existing && row.changes) {
                        const updatePayload: any = {};
                        Object.entries(row.changes).forEach(([key, diff]: [string, any]) => {
                            updatePayload[key] = diff.new;
                        });

                        if (Object.keys(updatePayload).length > 0) {
                            await adminStaffService.updateProfile(existing.id, updatePayload);
                        }
                    } else if (!existing) {
                        throw new Error('ไม่พบผู้ใช้รหัสนี้ในระบบ');
                    }
                }
                successCount++;
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`Failed to ${row.action} ${row.employee_code}:`, msg);
                rowErrors.push(`รหัส ${row.employee_code}: ${msg}`);
            }
            setProgress(Math.round(((i + 1) / toProcess.length) * 100));
        }

        const failedCount = toProcess.length - successCount;
        setImporting(false);
        onImportBatchComplete?.({
            success: successCount,
            failed: failedCount,
            errors: rowErrors,
            total: toProcess.length,
        });
        if (successCount > 0) {
            onSuccess();
        }
        if (successCount > 0 || toProcess.length === 0) {
            onClose();
        }
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
                            <br />
                            <span className="text-xs text-slate-400 dark:text-slate-500 mt-2 inline-block">
                                คอลัมน์อีเมลรองรับชื่อ: Email / อีเมล / E-mail
                            </span>
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
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFile(null);
                                    setProcessedRows([]);
                                    setParseError(null);
                                    setMissingEmailColumn(false);
                                }}
                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-xs px-4"
                            >
                                เปลี่ยนไฟล์
                            </Button>
                        </div>

                        {loading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-5">
                                <LoadingSpinner size={48} className="text-enterprise-600" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">กำลังประมวลผลข้อมูล...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {parseError && (
                                    <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-red-800 dark:text-red-200">อ่านไฟล์ไม่สำเร็จ</p>
                                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">{parseError}</p>
                                        </div>
                                    </div>
                                )}
                                {!parseError && missingEmailColumn && (
                                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
                                        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">ไม่พบคอลัมน์อีเมลในไฟล์</p>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                                ตั้งหัวคอลัมน์เป็น <span className="font-mono">Email</span>,{' '}
                                                <span className="font-mono">อีเมล</span>, <span className="font-mono">email</span> หรือ{' '}
                                                <span className="font-mono">E-mail</span> — ไม่เช่นนั้นอีเมลจะว่างและจะไม่ถูกอัปเดตจากไฟล์นี้
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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
                                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">เลือกไว้</p>
                                            <p className="text-2xl font-black text-blue-600">{stats.selected}</p>
                                        </div>
                                        <div className="p-4 bg-red-50/50 dark:bg-red-900/20 border border-red-100/50 dark:border-red-900/30 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase mb-1">บัญชีลาออก</p>
                                            <p className="text-2xl font-black text-red-600">{stats.resigned}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center opacity-70">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">ไม่มีการแก้ไข</p>
                                            <p className="text-2xl font-black text-slate-500">
                                                {stats.total - stats.create - stats.update - stats.resigned}
                                            </p>
                                        </div>
                                    </div>

                                {/* Filters */}
                                <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="ค้นหาชื่อ, รหัส..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 text-sm border-none bg-white dark:bg-slate-800 rounded-xl shadow-sm focus:ring-2 focus:ring-enterprise-500/30 focus:outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            value={actionFilter}
                                            onChange={(e) => setActionFilter(e.target.value as any)}
                                            className="px-4 py-2 text-xs font-bold border-none bg-white dark:bg-slate-800 rounded-xl shadow-sm focus:outline-none"
                                        >
                                            <option value="all">สถานะทั้งหมด</option>
                                            <option value="create">(+) เพิ่มใหม่</option>
                                            <option value="update">(≈) อัปเดต</option>
                                            <option value="resigned">(✖) ลาออก</option>
                                            <option value="skip">(•) ข้าม</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950">
                                    <div className="max-h-[380px] overflow-auto custom-scrollbar">
                                        <table className="w-full text-left border-separate border-spacing-0">
                                            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                                                <tr>
                                                    <th className="px-6 py-4 w-10">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={allSelected} 
                                                            onChange={toggleAll}
                                                            className="w-4 h-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500 cursor-pointer"
                                                        />
                                                    </th>
                                                    <th className="px-4 py-4 cursor-pointer" onClick={() => toggleSort('employee_code')}>รหัส {renderSortIcon('employee_code')}</th>
                                                    <th className="px-6 py-4 cursor-pointer" onClick={() => toggleSort('full_name')}>พนักงาน {renderSortIcon('full_name')}</th>
                                                    <th className="px-6 py-4">Role / สาขา</th>
                                                    <th className="px-6 py-4">สถานะ</th>
                                                    <th className="px-6 py-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm divide-y divide-slate-50 dark:divide-slate-900">
                                                {filteredRows.map((row, idx) => {
                                                    const isExpanded = expandedRow === idx;
                                                    return (
                                                        <React.Fragment key={row.employee_code}>
                                                            <tr className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all ${row.action === 'skip' ? 'opacity-60' : ''} ${row.selected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                                                <td className="px-6 py-4">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={row.selected} 
                                                                        onChange={() => toggleRow(row.employee_code)}
                                                                        disabled={row.action === 'skip'}
                                                                        className="w-4 h-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500 cursor-pointer disabled:cursor-not-allowed"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-4 font-mono text-[11px] font-bold text-slate-500">{row.employee_code}</td>
                                                                <td className="px-6 py-4 cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : idx)}>
                                                                    <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                                                        {row.name_prefix} {row.full_name}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-medium">{row.position || 'ไม่มีตำแหน่ง'}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col gap-1">
                                                                        <Badge variant="info" className="text-[10px] px-2 py-0 w-fit font-bold rounded-md bg-blue-50 text-blue-600 border-none">{row.role}</Badge>
                                                                        <span className="text-[10px] text-slate-400 font-medium">{row.branch}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {row.action === 'create' && <Badge variant="success" className="px-3 py-1 text-[10px] font-black rounded-xl">เพิ่มใหม่</Badge>}
                                                                    {row.action === 'update' && <Badge variant="warning" className="px-3 py-1 text-[10px] font-black rounded-xl">อัปเดต</Badge>}
                                                                    {row.action === 'skip' && <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">ข้าม</span>}
                                                                    {row.is_resigned && <Badge variant="error" className="ml-1 px-3 py-1 text-[10px] font-black rounded-xl">ลาออก</Badge>}
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <ArrowRight 
                                                                        size={14} 
                                                                        className={`text-slate-300 transition-all cursor-pointer ${isExpanded ? 'rotate-90 text-blue-500' : ''}`} 
                                                                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                                                    />
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-slate-50/80 dark:bg-slate-900/40">
                                                                    <td colSpan={6} className="p-6 border-t border-slate-100 dark:border-slate-800">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                                                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                                    <Info size={12} className="text-blue-500" /> ข้อมูลที่จะนำเข้า
                                                                                </h5>
                                                                                <div className="space-y-2">
                                                                                    <div className="flex justify-between text-xs border-b border-slate-50 dark:border-slate-700/50 pb-1.5"><span className="text-slate-400">ชื่อ-นามสกุล:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{row.full_name}</span></div>
                                                                                    <div className="flex justify-between text-xs border-b border-slate-50 dark:border-slate-700/50 pb-1.5"><span className="text-slate-400">อีเมล:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{row.email || row.employee_code + '@staff.local'}</span></div>
                                                                                    <div className="flex justify-between text-xs border-b border-slate-50 dark:border-slate-700/50 pb-1.5"><span className="text-slate-400">เบอร์โทร:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{row.phone || '-'}</span></div>
                                                                                    <div className="flex justify-between text-xs border-b border-slate-50 dark:border-slate-700/50 pb-1.5"><span className="text-slate-400">ตำแหน่ง:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{row.position || '-'}</span></div>
                                                                                    <div className="flex justify-between text-xs border-b border-slate-50 dark:border-slate-700/50 pb-1.5"><span className="text-slate-400">แผนก:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{row.department || '-'}</span></div>
                                                                                    <div className="flex justify-between text-xs"><span className="text-slate-400">สถานะลาออก:</span> <span className={`font-bold ${row.is_resigned ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{row.is_resigned ? 'ใช่' : 'ไม่ใช่'}</span></div>
                                                                                </div>
                                                                            </div>
                                                                            {row.action === 'update' && row.changes && (
                                                                                <div className="space-y-3">
                                                                                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                                        <AlertCircle size={12} className="text-orange-500" /> รายการที่เปลี่ยนแปลง
                                                                                    </h5>
                                                                                    <div className="grid grid-cols-1 gap-2">
                                                                                        {Object.entries(row.changes).map(([key, diff]: [string, any]) => (
                                                                                            <div key={key} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-[10px] shadow-sm">
                                                                                                <span className="font-black text-slate-400 uppercase">{key}:</span>
                                                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                                                    <span className="line-through text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded italic">{diff.old || '(ไม่มี)'}</span>
                                                                                                    <ArrowRight size={10} className="text-slate-300" />
                                                                                                    <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{diff.new}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={onClose} disabled={importing} className="font-bold text-slate-500">ยกเลิก</Button>
                {file && !loading && (
                    <Button 
                        onClick={handleImport} 
                        disabled={importing || stats.selected === 0}
                        className="min-w-[200px] bg-enterprise-600 hover:bg-enterprise-700 text-white font-black rounded-xl shadow-lg shadow-enterprise-500/20 active:scale-95 transition-all"
                    >
                        {importing ? (
                            <><LoadingSpinner size={18} className="mr-2" /> กำลังนำเข้า {progress}%</>
                        ) : (
                            <><CheckCircle size={18} className="mr-2" /> ยืนยันนำเข้า ({stats.selected} รายการ)</>
                        )}
                    </Button>
                )}
            </div>
        </Modal>
    );
};

const XLSX_ICON = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7.5L14.5 2zM14 8V3.5L18.5 8H14zM16 19h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V9h8v2z" />
    </svg>
);
