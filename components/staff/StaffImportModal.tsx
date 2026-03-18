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
        if (actionFilter !== 'all') {
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

    const renderSortIcon = (key: any) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
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
                        <div className="flex flex-wrap items-center justify-between gap-4">
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
                                {/* Stats & Filters */}
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                    <Card className="p-3 bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 lg:col-span-1">
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">สรุปเบื้องต้น</p>
                                        <div className="flex gap-4 mt-1">
                                            <div>
                                                <p className="text-xs text-slate-500">สร้างใหม่</p>
                                                <p className="text-lg font-bold text-green-600">{stats.create}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">อัปเดต</p>
                                                <p className="text-lg font-bold text-orange-600">{stats.update}</p>
                                            </div>
                                        </div>
                                    </Card>

                                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="ค้นหาชื่อ หรือรหัส..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <select
                                            value={actionFilter}
                                            onChange={(e) => setActionFilter(e.target.value as any)}
                                            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none"
                                        >
                                            <option value="all">การดำเนินการทั้งหมด</option>
                                            <option value="create">เพิ่มอย่างเดียว</option>
                                            <option value="update">อัปเดตอย่างเดียว</option>
                                            <option value="skip">ไม่เปลี่ยนแปลง</option>
                                        </select>
                                        <select
                                            value={roleFilter}
                                            onChange={(e) => setRoleFilter(e.target.value)}
                                            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none"
                                        >
                                            <option value="all">บทบาททั้งหมด</option>
                                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="max-h-[400px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
                                    <table className="w-full text-left border-separate border-spacing-0">
                                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500">
                                            <tr>
                                                <th className="px-4 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort('employee_code')}>
                                                    รหัส {renderSortIcon('employee_code')}
                                                </th>
                                                <th className="px-4 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort('full_name')}>
                                                    ชื่อ-นามสกุล {renderSortIcon('full_name')}
                                                </th>
                                                <th className="px-4 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort('role')}>
                                                    Role/สาขา {renderSortIcon('role')}
                                                </th>
                                                <th className="px-4 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort('action')}>
                                                    สถานะ {renderSortIcon('action')}
                                                </th>
                                                <th className="px-4 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic">ไม่พบคออมูลที่ค้นหา</td>
                                                </tr>
                                            ) : (
                                                filteredRows.map((row, idx) => {
                                                    const isExpanded = expandedRow === idx;
                                                    return (
                                                        <React.Fragment key={idx}>
                                                            <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors ${row.action === 'skip' ? 'opacity-50' : ''}`}>
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
                                                                        <div className="flex flex-col gap-1">
                                                                            <Badge variant="warning">อัปเดต</Badge>
                                                                            <span className="text-[10px] text-slate-400">{Object.keys(row.changes || {}).length} รายการ</span>
                                                                        </div>
                                                                    )}
                                                                    {row.action === 'skip' && <span className="text-xs text-slate-400 italic">ไม่มีการแก้ไข</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="p-1 h-auto"
                                                                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                                                    >
                                                                        <Info size={16} className={isExpanded ? 'text-blue-600' : 'text-slate-400'} />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-slate-50 dark:bg-slate-900/30">
                                                                    <td colSpan={5} className="px-8 py-4 border-t border-slate-200 dark:border-slate-800">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                            {/* Full Details */}
                                                                            <div>
                                                                                <h5 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                                                                                    <Info size={12} /> ข้อมูลทั้งหมดที่จะนำเข้า
                                                                                </h5>
                                                                                <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                                                    <span className="text-slate-500">รหัสพนักงาน:</span> <span className="font-medium">{row.employee_code}</span>
                                                                                    <span className="text-slate-500">ชื่อ-นามสกุล:</span> <span className="font-medium">{row.name_prefix}{row.full_name}</span>
                                                                                    <span className="text-slate-500">ตำแหน่ง:</span> <span className="font-medium">{row.position || '-'}</span>
                                                                                    <span className="text-slate-500">แผนก:</span> <span className="font-medium">{row.department || '-'}</span>
                                                                                    <span className="text-slate-500">เบอร์โทร:</span> <span className="font-medium">{row.phone || '-'}</span>
                                                                                    <span className="text-slate-500">อีเมล:</span> <span className="font-medium">{row.email || '(อัตโนมัติ)'}</span>
                                                                                    <span className="text-slate-500">สาขา:</span> <span className="font-medium">{row.branch}</span>
                                                                                    <span className="text-slate-500">Role:</span> <span className="font-medium text-blue-600">{row.role}</span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Change Comparison for Updates */}
                                                                            {row.action === 'update' && row.changes && (
                                                                                <div>
                                                                                    <h5 className="text-xs font-bold text-orange-500 uppercase mb-3 flex items-center gap-1.5">
                                                                                        <AlertCircle size={12} /> รายการที่มีการเปลี่ยนแปลง
                                                                                    </h5>
                                                                                    <div className="space-y-2">
                                                                                        {Object.entries(row.changes).map(([key, diff]) => {
                                                                                            const d = diff as { old: any, new: any };
                                                                                            const labels: Record<string, string> = {
                                                                                                full_name: 'ชื่อ-นามสกุล',
                                                                                                name_prefix: 'คำนำหน้า',
                                                                                                role: 'บทบาท',
                                                                                                branch: 'สาขา',
                                                                                                department: 'แผนก',
                                                                                                position: 'ตำแหน่ง',
                                                                                                phone: 'เบอร์โทร'
                                                                                            };
                                                                                            return (
                                                                                                <div key={key} className="flex flex-col p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{labels[key] || key}</span>
                                                                                                    <div className="flex items-center gap-2 mt-1">
                                                                                                        <span className="text-xs text-slate-400 line-through truncate max-w-[120px]">{d.old || '(ว่าง)'}</span>
                                                                                                        <ArrowRight size={10} className="text-slate-300" />
                                                                                                        <span className="text-xs text-blue-600 font-bold truncate">{d.new || '(ว่าง)'}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            )}
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
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={onClose} disabled={importing}>ยกเลิก</Button>
                {file && !loading && (
                    <Button 
                        onClick={handleImport} 
                        disabled={importing || (stats.create === 0 && stats.update === 0)}
                        className="min-w-[150px] bg-enterprise-600 hover:bg-enterprise-700 text-white"
                    >
                        {importing ? (
                            <>
                                <LoadingSpinner size={16} className="mr-2" />
                                กำลังดำเนินการ {progress}%
                            </>
                        ) : (
                            <>
                                <CheckCircle size={16} className="mr-2" />
                                นำเข้า {stats.create + stats.update} รายการ
                            </>
                        )}
                    </Button>
                )}
            </div>
        </Modal>
    );
};
