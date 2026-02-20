import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Search, ArrowRight, Save, History, Package, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';

// Unit Mapping as requested
const UNIT_MAP: Record<string, string> = {
    'BT': 'ขวด',
    'CN': 'กระป๋อง',
    'TR': 'ถาด',
    'CV': 'ลัง',
    'PA': 'แพ็ค',
    'CA': 'คาร์ตั้น', // Defaulting CA to คาร์ตั้น as discussed
};

interface ImportLogRow {
    id: string;
    import_date: string;
    product_code: string;
    product_name: string;
    unit: string;
    action_type: 'created' | 'updated';
    changes: any;
    created_at: string;
}

export function ExcelImportView() {
    const { profile } = useAuth();
    const { showNotification } = useNotification();
    const [activeSubTab, setActiveSubTab] = useState<'import' | 'history'>('import');

    // Import states
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importStats, setImportStats] = useState({ total: 0, created: 0, updated: 0, failed: 0 });

    // History states
    const [logs, setLogs] = useState<ImportLogRow[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logSearchQuery, setLogSearchQuery] = useState('');

    useEffect(() => {
        if (activeSubTab === 'history') {
            fetchLogs();
        }
    }, [activeSubTab]);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const { data, error } = await supabase
                .from('product_import_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            showNotification('error', 'ไม่สามารถโหลดประวัติการนำเข้าได้: ' + error.message);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Read from Row 8 (range: 7)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 7 }) as any[][];

            if (jsonData.length === 0) {
                showNotification('error', 'ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่ถูกต้อง');
                return;
            }

            const headers = jsonData[0];
            const items = jsonData.slice(1).filter(row => row[0]); // Filter out empty rows

            // Map columns
            const colIndices = {
                code: headers.findIndex(h => h && h.toString().includes('รหัส')),
                name: headers.findIndex(h => h && h.toString().includes('สินค้า')),
                unit: headers.findIndex(h => h && h.toString().includes('หน่วย')),
                prices: [] as { level: string; index: number }[]
            };

            for (let i = 1; i <= 9; i++) {
                const idx = headers.findIndex(h => h && h.toString().includes(`ราคา ${i}`));
                if (idx !== -1) colIndices.prices.push({ level: i.toString(), index: idx });
            }

            const mappedItems = items.map(row => {
                const rawUnit = row[colIndices.unit] ? row[colIndices.unit].toString().trim() : '';
                return {
                    code: row[colIndices.code]?.toString().trim() || '',
                    name: row[colIndices.name]?.toString().trim() || '',
                    unit: UNIT_MAP[rawUnit] || rawUnit,
                    prices: colIndices.prices.map(p => ({
                        level: p.level,
                        price: parseFloat(row[p.index] || '0')
                    }))
                };
            });

            setPreviewData(mappedItems);
        };
        reader.readAsArrayBuffer(file);
    };

    const startImport = async () => {
        if (previewData.length === 0) return;

        setIsProcessing(true);
        let created = 0;
        let updated = 0;
        let failed = 0;

        // We'll use the current date for the import
        const importDate = new Date().toISOString().split('T')[0];

        for (const item of previewData) {
            try {
                // 1. Check if product exists
                const { data: existingProduct } = await supabase
                    .from('products')
                    .select('id, base_price, unit')
                    .eq('product_code', item.code)
                    .maybeSingle();

                let productId = existingProduct?.id;
                let actionType: 'created' | 'updated' = 'updated';
                let changes: any = {};

                if (!existingProduct) {
                    // CREATE
                    const { data: newP, error: pError } = await supabase
                        .from('products')
                        .insert({
                            product_code: item.code,
                            product_name: item.name,
                            unit: item.unit,
                            base_price: item.prices[0]?.price || 0,
                            is_active: true
                        })
                        .select()
                        .single();

                    if (pError) throw pError;
                    productId = newP.id;
                    actionType = 'created';
                    changes = { initial_prices: item.prices };
                    created++;
                } else {
                    // UPDATE Product if needed
                    const pChanges: any = {};
                    if (existingProduct.unit !== item.unit) pChanges.unit = item.unit;
                    if (existingProduct.base_price !== item.prices[0]?.price) pChanges.base_price = item.prices[0]?.price;

                    if (Object.keys(pChanges).length > 0) {
                        await supabase.from('products').update(pChanges).eq('id', productId);
                        changes = { ...pChanges };
                    }
                    updated++;
                }

                // 2. Upsert Tier Prices
                for (const pInfo of item.prices) {
                    if (pInfo.price === 0) continue;

                    await supabase
                        .from('product_tier_prices')
                        .upsert({
                            product_id: productId,
                            tier_code: pInfo.level,
                            price_per_unit: pInfo.price,
                            effective_from: importDate
                        }, { onConflict: 'product_id, tier_code' });
                }

                // 3. Log the action
                await supabase.from('product_import_logs').insert({
                    import_date: importDate,
                    product_code: item.code,
                    product_name: item.name,
                    unit: item.unit,
                    action_type: actionType,
                    changes: changes,
                    created_by: profile?.id
                });

            } catch (err) {
                console.error(`Failed to import ${item.code}:`, err);
                failed++;
            }
        }

        setImportStats({ total: previewData.length, created, updated, failed });
        setIsProcessing(false);
        showNotification('success', `นำเข้าข้อมูลเสร็จสิ้น: เพิ่มใหม่ ${created}, อัปเดต ${updated}, ล้มเหลว ${failed}`);
        setPreviewData([]);
        setFile(null);
    };

    const filteredLogs = logs.filter(log =>
        log.product_code.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
        log.product_name.toLowerCase().includes(logSearchQuery.toLowerCase())
    );

    return (
        <PageLayout title="นำเข้าข้อมูล (ฝ่ายขาย - Step Pricing)">
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveSubTab('import')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${activeSubTab === 'import'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                >
                    <Upload size={18} />
                    นำเข้าข้อมูล
                </button>
                <button
                    onClick={() => setActiveSubTab('history')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${activeSubTab === 'history'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                >
                    <History size={18} />
                    ประวัติการนำเข้า (LOG)
                </button>
            </div>

            {activeSubTab === 'import' ? (
                <div className="space-y-6">
                    <Card className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
                            <Upload size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">อัปโหลดไฟล์ Step Pricing</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                            เลือกไฟล์ Excel (.xlsx) ที่ส่งออกจากระบบ SinghaChan เพื่ออัปเดตราคาทุกระดับโดยอัตโนมัติ
                        </p>

                        <label className="relative">
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileChange}
                                className="hidden"
                                disabled={isProcessing}
                            />
                            <Button disabled={isProcessing} className="px-8 cursor-pointer">
                                {isProcessing ? <LoadingSpinner size={16} className="mr-2" /> : null}
                                {file ? file.name : 'เลือกไฟล์ Excel'}
                            </Button>
                        </label>

                        <div className="mt-4 flex gap-4 text-xs text-slate-400">
                            <span>• รองรับหน่วย BT, CN, TR, CV, PA, CA</span>
                            <span>• เริ่มอ่านข้อมูลตั้งแต่แถวที่ 8</span>
                        </div>
                    </Card>

                    {previewData.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                    ตัวอย่างข้อมูล ({previewData.length} รายการ)
                                </h4>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setPreviewData([])} disabled={isProcessing}>
                                        ยกเลิก
                                    </Button>
                                    <Button onClick={startImport} disabled={isProcessing}>
                                        <Save size={18} className="mr-2" />
                                        ยืนยันการนำเข้าข้อมูล
                                    </Button>
                                </div>
                            </div>

                            <Card className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-300">รหัส</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-300">ชื่อสินค้า</th>
                                                <th className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">หน่วย</th>
                                                <th className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">ราคา 1 (ฐาน)</th>
                                                <th className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">ราคา 9 (ต่ำสุด)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.slice(0, 50).map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                                                    <td className="px-4 py-3">{item.name}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge>{item.unit}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold">{item.prices[0]?.price.toLocaleString()} ฿</td>
                                                    <td className="px-4 py-3 text-right">{item.prices[item.prices.length - 1]?.price.toLocaleString() || '-'} ฿</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {previewData.length > 50 && (
                                        <div className="p-4 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 italic">
                                            แสดงเพียง 50 รายการแรก จากทั้งหมด {previewData.length} รายการ
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ค้นหารหัส หรือชื่อสินค้าใน Log..."
                                value={logSearchQuery}
                                onChange={(e) => setLogSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <Button variant="outline" onClick={fetchLogs} disabled={loadingLogs}>
                            <Clock size={16} className="mr-2" />
                            รีเฟรชประวัติ
                        </Button>
                    </div>

                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            {loadingLogs ? (
                                <div className="p-12 text-center">
                                    <LoadingSpinner className="mx-auto mb-4" />
                                    <p className="text-slate-500">กำลังโหลดประวัติ...</p>
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <FileText className="mx-auto mb-4 opacity-20" size={48} />
                                    <p>ไม่พบประวัติการนำเข้า</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                            <th className="px-4 py-3 text-left font-bold">วัน/เวลา นำเข้า</th>
                                            <th className="px-4 py-3 text-left font-bold">รหัสสินค้า</th>
                                            <th className="px-4 py-3 text-left font-bold">ดำเนินการ</th>
                                            <th className="px-4 py-3 text-left font-bold">รายละเอียดการเปลี่ยนแปลง</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLogs.map((log) => (
                                            <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-xs text-slate-500">
                                                    {new Date(log.created_at).toLocaleString('th-TH')}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">{log.product_code}</td>
                                                <td className="px-4 py-3">
                                                    {log.action_type === 'created' ? (
                                                        <Badge className="bg-green-100 text-green-700 border-green-200">เพิ่มใหม่</Badge>
                                                    ) : (
                                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">อัปเดต</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="max-w-md overflow-hidden text-ellipsis">
                                                        {renderChangeDetails(log.changes, log.action_type)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </PageLayout>
    );
}

function renderChangeDetails(changes: any, type: string) {
    if (type === 'created') {
        return <span className="text-xs text-slate-500 italic">บันทึกข้อมูลสินค้าและราคาทั้ง 9 ระดับเริ่มต้น</span>;
    }

    const entries = Object.entries(changes || {});
    if (entries.length === 0) return <span className="text-xs text-slate-400 italic">ไม่พบการเปลี่ยนแปลงฟิลด์หลัก</span>;

    return (
        <div className="flex flex-wrap gap-2">
            {entries.map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                    <span className="font-bold">{key}:</span>
                    <span className="text-slate-500 line-through">{val.old?.toString() || '-'}</span>
                    <ArrowRight size={10} className="text-slate-400" />
                    <span className="text-blue-600 dark:text-blue-400">{val.new?.toString() || val.toString()}</span>
                </div>
            ))}
        </div>
    );
}
