import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Search, Save, Package, Users, ChevronLeft, ChevronRight, ArrowRight, Pencil, Trash2, Filter, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Progress } from '../components/ui/Progress';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { componentStyles } from '../theme/designTokens';

interface CustomerData {
    code: string;
    armCode: string;
    name: string;
    address: string;
    taxId: string;
    province: string;
    district: string;
    subDistrict: string;
    salesman: string;
    branch: string;
    tierCode: string;
    status: string;
    isNew: boolean;
    isUnchanged?: boolean;
    oldData?: {
        id: string;
        name: string;
        address: string;
        branch: string;
        tierCode: string;
    };
}

interface ImportResult {
    total: number;
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
    failedItems: { code: string; name: string; reason: string }[];
    createdItems: { code: string; name: string }[];
    updatedItems: { code: string; name: string; changes: any }[];
}

interface ImportStats {
    total: number;
    created: number;
    updated: number;
    unchanged: number;
}

export function CustomerImportView() {
    const { profile } = useAuth();
    const { showNotification } = useNotification();
    
    // UI states
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<CustomerData[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [importProgress, setImportProgress] = useState(0);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [resultTab, setResultTab] = useState<'created' | 'updated' | 'failed'>('failed');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'updated' | 'unchanged'>('all');
    const [branchFilter, setBranchFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const importStats: ImportStats = useMemo(() => {
        const stats: ImportStats = { total: previewData.length, created: 0, updated: 0, unchanged: 0 };
        previewData.forEach(item => {
            if (item.isNew) stats.created++;
            else if (item.isUnchanged) stats.unchanged++;
            else stats.updated++;
        });
        return stats;
    }, [previewData]);

    const branches = useMemo(() => ['all', ...Array.from(new Set(previewData.map(i => i.branch)))], [previewData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    /**
     * Normalize string for comparison: trim, handle null, and standardize white space
     */
    const normalize = (val: any) => {
        if (val === null || val === undefined) return "";
        return val.toString().trim().replace(/\s+/g, ' ');
    };

    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };

    const parseFile = async (file: File) => {
        setIsProcessing(true);
        setProcessingProgress(0);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const sheetTarget = "รายชื่อลูกค้าทั้งหมด";
                const sheetName = workbook.SheetNames.find(s => s.trim().includes(sheetTarget)) || workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Heuristic Header Detection
                const fullSheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                let headerRowIndex = -1;
                const requiredPatterns = [['รหัส', 'ชื่อ'], ['CUSTOMER', 'NAME']];
                
                for (let i = 0; i < Math.min(fullSheetData.length, 30); i++) {
                    const row = (fullSheetData[i] || []).map(cell => cell?.toString().trim() || '');
                    if (requiredPatterns.some(pair => pair.every(h => row.some(cell => cell === h || cell.includes(h))))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error(`ไม่พบหัวตารางใน 30 แถวแรกของ Sheet: ${sheetName}`);
                }

                const headers = (fullSheetData[headerRowIndex] as any[]).map(h => h?.toString().trim() || '');
                const findIdx = (targets: string[]) => {
                    const exact = headers.findIndex(h => targets.some(t => h.toLowerCase() === t.toLowerCase()));
                    if (exact !== -1) return exact;
                    return headers.findIndex(h => targets.some(t => h.includes(t)));
                };

                const colIdx = {
                    code: findIdx(['รหัส']),
                    armCode: findIdx(['รหัสอาร์ม']),
                    name: findIdx(['ชื่อ', 'ชื่อลูกค้า']),
                    address: findIdx(['ทีอยู่', 'ที่อยู่']),
                    taxId: findIdx(['เลขผู้เสียภาษี']),
                    province: findIdx(['จังหวัด']),
                    district: findIdx(['อำเภอ']),
                    subDistrict: findIdx(['ตำบล']),
                    status: findIdx(['สถานะ']),
                    salesman: findIdx(['พนักงานขาย']),
                    tier: findIdx(['ระดับราคาขาย']),
                };

                if (colIdx.code === -1 || colIdx.name === -1) {
                    throw new Error(`ระบุตำแหน่ง "รหัส" หรือ "ชื่อ" ไม่สำเร็จ (Row ${headerRowIndex + 1})`);
                }

                const itemsRaw = fullSheetData.slice(headerRowIndex + 1);
                const itemsFiltered: any[][] = [];
                let emptyRowStreak = 0;
                for (const row of itemsRaw) {
                    if (row[colIdx.code] || row[colIdx.name]) {
                        itemsFiltered.push(row);
                        emptyRowStreak = 0;
                    } else {
                        emptyRowStreak++;
                        if (emptyRowStreak > 50) break;
                    }
                }

                if (!itemsFiltered.length) throw new Error('ไม่พบข้อมูลลูกค้าในไฟล์');

                const codes = itemsFiltered.map(r => r[colIdx.code]?.toString().trim()).filter(Boolean);
                const tiersResp = await supabase.from('customer_tiers').select('id, tier_code');
                const tierIdToCode: Record<string, string> = {};
                tiersResp.data?.forEach(t => tierIdToCode[t.id] = t.tier_code.trim());

                const existingMap: Record<string, any> = {};
                const chunks = chunkArray(codes, 500);
                
                for (let i = 0; i < chunks.length; i++) {
                    setProcessingProgress(Math.round(((i + 1) / chunks.length) * 100));
                    const { data: stores } = await supabase.from('stores')
                        .select('id, customer_code, customer_name, address, branch, tier_id')
                        .in('customer_code', chunks[i]);
                    stores?.forEach(s => existingMap[s.customer_code.trim()] = s);
                }

                const mappedItems: CustomerData[] = itemsFiltered.map(row => {
                    const code = row[colIdx.code]?.toString().trim() || '';
                    if (!code) return null;
                    const name = row[colIdx.name]?.toString().trim() || '';
                    const salesman = colIdx.salesman !== -1 ? row[colIdx.salesman]?.toString().trim() || '' : '';
                    const branch = (salesman.startsWith('ภาวดี') || salesman.startsWith('นุกูล')) ? 'SD' : 'HQ';
                    const rawTier = colIdx.tier !== -1 ? row[colIdx.tier]?.toString().trim() || '' : '';
                    const address = colIdx.address !== -1 ? row[colIdx.address]?.toString().trim() || '' : '';
                    const status = colIdx.status !== -1 ? row[colIdx.status]?.toString().trim() || '' : '';
                    
                    const existing = existingMap[code];
                    let isUnchanged = false;
                    if (existing) {
                        const existingTier = tierIdToCode[existing.tier_id] || '';
                        // Resilient comparison using normalize()
                        isUnchanged = normalize(existing.customer_name) === normalize(name) && 
                                     normalize(existing.branch) === normalize(branch) && 
                                     normalize(existingTier) === normalize(rawTier) && 
                                     normalize(existing.address) === normalize(address);
                    }

                    return {
                        code, armCode: colIdx.armCode !== -1 ? row[colIdx.armCode]?.toString().trim() : '',
                        name, address, salesman, branch, tierCode: rawTier, status,
                        taxId: colIdx.taxId !== -1 ? row[colIdx.taxId]?.toString().trim() : '',
                        province: colIdx.province !== -1 ? row[colIdx.province]?.toString().trim() : '',
                        district: colIdx.district !== -1 ? row[colIdx.district]?.toString().trim() : '',
                        subDistrict: colIdx.subDistrict !== -1 ? row[colIdx.subDistrict]?.toString().trim() : '',
                        isNew: !existing, isUnchanged,
                        oldData: existing ? {
                            id: existing.id, name: existing.customer_name, address: existing.address || '',
                            branch: existing.branch, tierCode: tierIdToCode[existing.tier_id] || ''
                        } : undefined
                    };
                }).filter(Boolean) as CustomerData[];

                setPreviewData(mappedItems);
                showNotification('success', `วิเคราะห์สำเร็จ! พบ ${mappedItems.length} รายการ (จาก Sheet: ${sheetName})`);
            } catch (err: any) {
                showNotification('error', err.message);
                console.error('[ImportError]', err);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const startImport = async () => {
        const toImport = previewData.filter(i => !i.isUnchanged);
        if (!toImport.length) return;

        setIsImporting(true);
        setImportProgress(0);

        const results: ImportResult = { total: toImport.length, created: 0, updated: 0, unchanged: importStats.unchanged, failed: 0, failedItems: [], createdItems: [], updatedItems: [] };
        const tiers = await supabase.from('customer_tiers').select('id, tier_code');
        const tierCodeToId: Record<string, string> = {};
        tiers.data?.forEach(t => tierCodeToId[t.tier_code.trim()] = t.id);

        for (let i = 0; i < toImport.length; i++) {
            const item = toImport[i];
            try {
                const isActive = !item.status.includes('ยกเลิก') && !item.status.includes('ไม่เคลื่อนไหว');
                const tierId = item.tierCode ? tierCodeToId[item.tierCode.trim()] : null;
                const payload = {
                    customer_name: item.name, address: item.address || null, branch: item.branch,
                    tier_id: tierId, is_active: isActive, updated_by: profile?.id
                };

                if (item.isNew) {
                    const { error } = await supabase.from('stores').insert({ ...payload, customer_code: item.code, created_by: profile?.id });
                    if (error) throw error;
                    results.created++;
                    results.createdItems.push({ code: item.code, name: item.name });
                } else {
                    const { error } = await supabase.from('stores').update(payload).eq('id', item.oldData?.id);
                    if (error) throw error;
                    results.updated++;
                    results.updatedItems.push({ code: item.code, name: item.name, changes: {} });
                }
            } catch (err: any) {
                results.failed++;
                results.failedItems.push({ code: item.code, name: item.name, reason: err.message });
            }
            setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
        }

        setImportResult(results);
        setResultTab(results.failed > 0 ? 'failed' : results.updated > 0 ? 'updated' : 'created');
        setShowResultModal(true);
        setIsImporting(false);
        showNotification(results.failed === 0 ? 'success' : 'warning', `การนำเข้าเสร็จสมบูรณ์`);
    };

    const filteredPreview = useMemo(() => {
        let res = previewData;
        if (searchTerm) res = res.filter(i => i.code.toLowerCase().includes(searchTerm.toLowerCase()) || i.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (statusFilter !== 'all') res = res.filter(i => (statusFilter === 'new' ? i.isNew : (statusFilter === 'unchanged' ? i.isUnchanged : (!i.isNew && !i.isUnchanged))));
        if (branchFilter !== 'all') res = res.filter(i => i.branch === branchFilter);
        return res;
    }, [previewData, searchTerm, statusFilter, branchFilter]);

    const totalPages = Math.ceil(filteredPreview.length / itemsPerPage);

    /**
     * Renders a value with a strike-through old value if it changed
     */
    const renderDiff = (oldVal: any, newVal: any, label?: string) => {
        if (oldVal === undefined) return <span className="text-emerald-600 font-medium">{newVal}</span>;
        
        const normOld = normalize(oldVal);
        const normNew = normalize(newVal);
        const isChanged = normOld !== normNew;

        if (!isChanged) return <span className="text-slate-600">{newVal}</span>;

        return (
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 line-through truncate max-w-[200px]" title={oldVal || '-'}>
                    {label ? `${label}: ` : ''}{oldVal || '-'}
                </span>
                <span className="text-sm text-amber-600 font-medium truncate max-w-[200px]" title={newVal}>
                    {newVal}
                </span>
            </div>
        );
    };

    return (
        <PageLayout title="นำเข้าข้อมูลลูกค้า (Customer Import)">
            {!file ? (
                <Card className="p-12 border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                        <Upload size={32} className="text-enterprise-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">อัปโหลดรายชื่อลูกค้า</h3>
                    <p className="text-slate-500 mb-6 max-w-md text-sm">เลือกไฟล์ Excel ทรงสคริปต์ Power Query ระบบจะเปรียบเทียบข้อมูลและแสดงส่วนที่เปลี่ยนแปลงให้เห็นก่อนยืนยัน</p>
                    <label className="cursor-pointer">
                        <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                        <div className={`${componentStyles.button.base} ${componentStyles.button.primary}`}>เลือกไฟล์ Excel</div>
                    </label>
                </Card>
            ) : (isProcessing || isImporting) ? (
                <Card className="p-12 text-center text-slate-900 dark:text-white">
                    <h3 className="text-lg font-bold mb-4">{isProcessing ? 'กำลังวิเคราะห์ฐานข้อมูลลูกค้า...' : 'กำลังนำเข้าข้อมูล...'}</h3>
                    <Progress value={isProcessing ? processingProgress : importProgress} className="h-3 mb-2" />
                    <p className="text-sm text-slate-500">{isProcessing ? `${processingProgress}% ดำเนินการ` : `${importProgress}% ดำเนินการ`}</p>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="p-4 border-l-4 border-l-blue-500"><p className="text-xs text-slate-500">ทั้งหมด</p><h4 className="text-2xl font-bold">{importStats.total}</h4></Card>
                        <Card className="p-4 border-l-4 border-l-emerald-500"><p className="text-xs text-slate-500">เพิ่มใหม่</p><h4 className="text-2xl font-bold text-emerald-600">{importStats.created}</h4></Card>
                        <Card className="p-4 border-l-4 border-l-amber-500"><p className="text-xs text-slate-500">อัปเดต</p><h4 className="text-2xl font-bold text-amber-600">{importStats.updated}</h4></Card>
                        <Card className="p-4 border-l-4 border-l-slate-400"><p className="text-xs text-slate-500">คงเดิม</p><h4 className="text-2xl font-bold text-slate-500">{importStats.unchanged}</h4></Card>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ค้นหารหัส/ชื่อ..." className="w-full pl-9 pr-4 py-1.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white" />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
                            <option value="all">ทุกสถานะ</option><option value="new">เพิ่มใหม่</option><option value="updated">อัปเดต</option><option value="unchanged">คงเดิม</option>
                        </select>
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" onClick={() => { setFile(null); setPreviewData([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}>ยกเลิก</Button>
                            <Button size="sm" onClick={startImport} disabled={importStats.created + importStats.updated === 0}>ยืนยันนำเข้า ({importStats.created + importStats.updated})</Button>
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold">
                                    <tr>
                                        <th className="p-3 text-left">รหัส</th>
                                        <th className="p-3 text-left">ชื่อ / ที่อยู่</th>
                                        <th className="p-3 text-left">สาขา</th>
                                        <th className="p-3 text-left">ระดับราคา</th>
                                        <th className="p-3 text-center">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPreview.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-50 dark:border-slate-800 transition-colors">
                                            <td className="p-3 font-mono text-xs">{item.code}</td>
                                            <td className="p-3">
                                                {renderDiff(item.oldData?.name, item.name)}
                                                <div className="mt-1">
                                                    {renderDiff(item.oldData?.address, item.address)}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {renderDiff(item.oldData?.branch, item.branch)}
                                            </td>
                                            <td className="p-3">
                                                {renderDiff(item.oldData?.tierCode, item.tierCode)}
                                            </td>
                                            <td className="p-3 text-center">
                                                {item.isNew ? <Badge variant="success">เพิ่มใหม่</Badge> : (item.isUnchanged ? <Badge variant="default" className="text-slate-400">คงเดิม</Badge> : <Badge variant="info">อัปเดต</Badge>)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="p-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                                <span className="text-xs text-slate-500">หน้า {currentPage} / {totalPages}</span>
                                <div className="flex gap-1">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14}/></Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={14}/></Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            <Modal isOpen={showResultModal} onClose={() => { setShowResultModal(false); setPreviewData([]); setFile(null); }} title="สรุปการนำเข้าข้อมูลลูกค้า" size="large">
                <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">ทั้งหมด</div>
                            <div className="text-2xl font-bold">{importResult?.total}</div>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                            <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">สำเร็จ</div>
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importResult?.created}</div>
                        </div>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                            <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">อัปเดต</div>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importResult?.updated}</div>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                            <div className="text-[10px] font-bold text-red-600 uppercase mb-1">ล้มเหลว</div>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult?.failed}</div>
                        </div>
                    </div>
                </div>
            </Modal>
        </PageLayout>
    );
}
