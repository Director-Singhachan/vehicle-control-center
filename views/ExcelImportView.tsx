import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Search, ArrowRight, Save, History, Package, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Unit Mapping as requested
const UNIT_MAP: Record<string, string> = {
    'BT': 'ขวด',
    'CN': 'กระป๋อง',
    'TR': 'ถาด',
    'CV': 'ลัง',
    'PA': 'แพ็ค',
    'CA': 'คาร์ตั้น',
};

// Category Mapping Rules
const CATEGORY_RULES = [
    { name: 'เบียร์สิงห์', required: ['เบียร์', 'สิงห์'] },
    { name: 'เบียร์ลีโอ', keywords: ['ลีโอ', 'LEO'] },
    { name: 'เบียร์คาร์ลสเบิร์ก', keywords: ['คาร์ลสเบิร์ก', 'Carlsberg'] },
    { name: 'เบียร์โคโรน่า', keywords: ['โคโรน่า', 'Corona'] },
    { name: 'เบียร์มาย', keywords: ['มาย', 'MY Beer', 'MYBEER'] },
    { name: 'เบียร์สโนวี่', keywords: ['สโนวี่', 'Snowy'] },
    { name: 'เบียร์อาซาฮี', keywords: ['อาซาฮี', 'Asahi'] },
    { name: 'น้ำดื่ม', keywords: ['น้ำดื่ม', 'น้ำสิงห์', 'Purra', 'เพอร์รา', 'น้ำแร่', 'Mineral'] },
    { name: 'โซดา', keywords: ['โซดา'] },
    { name: 'อิชิตัน', keywords: ['อิชิตัน', 'Ichitan'] },
    { name: 'เลม่อน', keywords: ['เลม่อน', 'Lemonade'] },
    { name: 'เหล้าอื่นๆ', keywords: ['เหล้า', 'ไวน์', 'วิสกี้', 'Spirit', 'บรั่นดี'] },
    { name: 'เบียร์อื่นๆ', keywords: ['เบียร์'] },
];

function getCategoryFromProductName(name: string): string {
    const upperName = name.toUpperCase();

    // Check specific rules
    for (const rule of CATEGORY_RULES) {
        if (rule.required) {
            // Must have all required keywords
            if (rule.required.every(k => upperName.includes(k.toUpperCase()))) {
                return rule.name;
            }
        } else if (rule.keywords) {
            // Must have at least one keyword
            if (rule.keywords.some(k => upperName.includes(k.toUpperCase()))) {
                return rule.name;
            }
        }
    }

    return 'อื่นๆ';
}

interface ProductData {
    code: string;
    name: string;
    unit: string;
    category: string;
    isNew: boolean;
    prices: { level: string; price: number }[];
    oldData?: {
        name: string;
        unit: string;
        category: string;
        prices: Record<string, number>; // level -> price
    };
}

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

interface ImportStats {
    total: number;
    created: number;
    updated: number;
    categoryDistribution: Record<string, number>;
}

export function ExcelImportView() {
    const { profile } = useAuth();
    const { showNotification } = useNotification();
    const [activeSubTab, setActiveSubTab] = useState<'import' | 'history'>('import');

    // Import states
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ProductData[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [showTemplateExample, setShowTemplateExample] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // History states
    const [logs, setLogs] = useState<ImportLogRow[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logSearchQuery, setLogSearchQuery] = useState('');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        setCurrentPage(1);
    }, [previewData]);

    const importStats: ImportStats = useMemo(() => {
        const stats: ImportStats = {
            total: previewData.length,
            created: 0,
            updated: 0,
            categoryDistribution: {},
        };

        previewData.forEach(item => {
            if (item.isNew) {
                stats.created++;
            } else {
                stats.updated++;
            }
            stats.categoryDistribution[item.category] = (stats.categoryDistribution[item.category] || 0) + 1;
        });

        return stats;
    }, [previewData]);

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
                .order('created_at', { ascending: false })
                .limit(100);

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

    const parseFile = async (file: File) => {
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
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

                const headers = (jsonData[0] as any[]).map(h => h?.toString().trim());
                const items = jsonData.slice(1).filter(row => row[0]); // Filter out empty rows

                // Map columns
                const colIndices = {
                    code: headers.findIndex(h => h && (h.toString().trim() === 'รหัสสินค้า' || h.toString().trim() === 'รหัส')),
                    name: headers.findIndex(h => h && (h.toString().trim() === 'ชื่อสินค้า' || h.toString().trim() === 'รายการ')),
                    unit: headers.findIndex(h => h && (h.toString().includes('หน่วย') || h.toString().includes('Unit'))),
                    prices: [] as { level: string; index: number }[]
                };

                // Fallbacks
                if (colIndices.code === -1) colIndices.code = headers.findIndex(h => h && h.toString().includes('รหัส'));
                if (colIndices.name === -1) colIndices.name = headers.findIndex(h => h && h.toString().includes('สินค้า') && !h.toString().includes('รหัส'));

                for (let i = 1; i <= 9; i++) {
                    const idx = headers.findIndex(h => h && h.includes(`ราคา ${i}`));
                    if (idx !== -1) colIndices.prices.push({ level: i.toString(), index: idx });
                }

                if (colIndices.code === -1 || colIndices.name === -1) {
                    showNotification('error', 'ไม่พบคอลัมน์รหัสสินค้าหรือชื่อสินค้า');
                    return;
                }

                // 1. Get Tier Mapping
                const { data: tierList } = await supabase.from('customer_tiers').select('id, tier_code');
                const tierCodeMap: Record<string, string> = {}; // id -> tier_code
                tierList?.forEach(t => { tierCodeMap[t.id] = t.tier_code; });

                // 2. Fetch existing products and prices
                const codes = items.map(row => row[colIndices.code]?.toString().trim()).filter(Boolean);
                const { data: existingProducts } = await supabase
                    .from('products')
                    .select('id, product_code, product_name, unit, category, product_tier_prices(tier_id, price)')
                    .in('product_code', codes);

                const existingMap: Record<string, any> = {};
                existingProducts?.forEach(p => {
                    const prices: Record<string, number> = {};
                    p.product_tier_prices?.forEach((tp: any) => {
                        const tCode = tierCodeMap[tp.tier_id];
                        if (tCode) prices[tCode] = tp.price;
                    });
                    existingMap[p.product_code] = { ...p, mappedPrices: prices };
                });

                const mappedItems: ProductData[] = items.map(row => {
                    const rawName = row[colIndices.name]?.toString().trim() || '';
                    const rawCode = row[colIndices.code]?.toString().trim() || '';
                    const rawUnit = row[colIndices.unit] ? row[colIndices.unit].toString().trim() : '';
                    const category = getCategoryFromProductName(rawName);
                    const existing = existingMap[rawCode];

                    return {
                        code: rawCode,
                        name: rawName,
                        unit: UNIT_MAP[rawUnit] || rawUnit,
                        category: category,
                        isNew: !existing,
                        prices: colIndices.prices.map(p => ({
                            level: p.level,
                            price: parseFloat(row[p.index] || '0')
                        })),
                        oldData: existing ? {
                            name: existing.product_name,
                            unit: existing.unit,
                            category: existing.category,
                            prices: existing.mappedPrices
                        } : undefined
                    };
                });

                setPreviewData(mappedItems);
                showNotification('success', `อ่านข้อมูลสำเร็จ ${mappedItems.length} รายการ`);
            } catch (err: any) {
                showNotification('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const startImport = async () => {
        if (previewData.length === 0) return;

        setIsProcessing(true);
        setIsImporting(true);
        setImportProgress(0);
        let created = 0;
        let updated = 0;
        let failed = 0;

        const importDate = new Date().toISOString().split('T')[0];

        // 0. Get Tier Mapping (tier_code -> id)
        const { data: tierList } = await supabase.from('customer_tiers').select('id, tier_code');
        const tierMap: Record<string, string> = {};
        tierList?.forEach(t => {
            tierMap[t.tier_code] = t.id;
        });

        const totalItems = previewData.length;
        for (let i = 0; i < totalItems; i++) {
            const item = previewData[i];
            try {
                // Update progress
                setImportProgress(Math.round(((i + 1) / totalItems) * 100));
                // 1. Check if product exists
                const { data: existingProduct } = await supabase
                    .from('products')
                    .select('id, base_price, unit, product_name, category')
                    .eq('product_code', item.code)
                    .maybeSingle();

                let productId;
                let actionType: 'created' | 'updated' = 'updated';
                let changes: any = {};

                if (!existingProduct) {
                    // CREATE
                    const { data: newP, error: pError } = await supabase
                        .from('products')
                        .insert({
                            product_code: item.code,
                            product_name: item.name,
                            category: item.category,
                            unit: item.unit,
                            base_price: item.prices[0]?.price || 0,
                            is_active: true,
                            created_by: profile?.id,
                            updated_by: profile?.id
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
                    productId = existingProduct.id;
                    const pChanges: any = {};
                    if (existingProduct.unit !== item.unit) pChanges.unit = { old: existingProduct.unit, new: item.unit };
                    if (existingProduct.product_name !== item.name) pChanges.product_name = { old: existingProduct.product_name, new: item.name };
                    if (existingProduct.base_price !== item.prices[0]?.price) pChanges.base_price = { old: existingProduct.base_price, new: item.prices[0]?.price };
                    if (existingProduct.category !== item.category) pChanges.category = { old: existingProduct.category, new: item.category };

                    if (Object.keys(pChanges).length > 0) {
                        const updateData: any = { updated_by: profile?.id };
                        if (pChanges.unit) updateData.unit = item.unit;
                        if (pChanges.product_name) updateData.product_name = item.name;
                        if (pChanges.base_price) updateData.base_price = item.prices[0]?.price;
                        if (pChanges.category) updateData.category = item.category;

                        await supabase.from('products').update(updateData).eq('id', productId);
                        changes = pChanges;
                    }
                    updated++;
                }

                // 2. Upsert Tier Prices
                for (const pInfo of item.prices) {
                    if (pInfo.price === 0) continue;
                    const tierId = tierMap[pInfo.level];
                    if (!tierId) continue;

                    await supabase
                        .from('product_tier_prices')
                        .upsert({
                            product_id: productId,
                            tier_id: tierId,
                            price: pInfo.price,
                            min_quantity: 1,
                            effective_from: importDate,
                            created_by: profile?.id,
                            is_active: true
                        }, { onConflict: 'product_id, tier_id, min_quantity' });
                }

                // 3. Log the action
                await supabase.from('product_import_logs').insert({
                    import_date: importDate,
                    product_code: item.code,
                    product_name: item.name,
                    unit: item.unit,
                    action_type: actionType,
                    changes: changes,
                });

            } catch (err) {
                console.error(`Failed to import ${item.code}:`, err);
                failed++;
            }
        }

        setIsProcessing(false);
        setIsImporting(false);
        setImportProgress(0);
        showNotification('success', `นำเข้าข้อมูลเสร็จสิ้น: เพิ่มใหม่ ${created}, อัปเดต ${updated}, ล้มเหลว ${failed}`);
        setPreviewData([]);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const filteredLogs = logs.filter(log =>
        log.product_code.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
        log.product_name.toLowerCase().includes(logSearchQuery.toLowerCase())
    );

    function renderDiff(oldVal: string | undefined, newVal: string, label?: string) {
        const isChanged = oldVal !== undefined && oldVal !== newVal;
        if (!isChanged) return <span>{newVal}</span>;

        return (
            <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 line-through decoration-red-400/50">{oldVal}</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                    <ArrowRight size={10} />
                    {newVal}
                </span>
            </div>
        );
    }

    function renderPriceDiff(oldPrice: number | undefined, newPrice: number) {
        const isChanged = oldPrice !== undefined && oldPrice !== newPrice;
        const colorClass = isChanged
            ? (newPrice > oldPrice ? 'text-green-600 font-bold' : 'text-red-600 font-bold')
            : 'text-slate-600 dark:text-slate-400';

        return (
            <div className="flex flex-col items-end">
                {isChanged && (
                    <span className="text-[9px] text-slate-400 line-through">{oldPrice?.toLocaleString()}</span>
                )}
                <span className={`text-xs ${colorClass}`}>{newPrice.toLocaleString()} ฿</span>
            </div>
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

    return (
        <PageLayout title="นำเข้าข้อมูล (ฝ่ายขาย - Step Pricing)">
            <div className="flex gap-4 mb-6">
                <Button
                    onClick={() => setActiveSubTab('import')}
                    variant={activeSubTab === 'import' ? 'primary' : 'outline'}
                    className="px-6 py-2.5 rounded-xl font-medium"
                >
                    <Upload size={18} />
                    นำเข้าข้อมูล
                </Button>
                <Button
                    onClick={() => setActiveSubTab('history')}
                    variant={activeSubTab === 'history' ? 'primary' : 'outline'}
                    className="px-6 py-2.5 rounded-xl font-medium"
                >
                    <History size={18} />
                    ประวัติการนำเข้า (LOG)
                </Button>
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

                        <div className="relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".xlsx"
                                onChange={handleFileChange}
                                className="hidden"
                                disabled={isProcessing}
                            />
                            <Button
                                disabled={isProcessing}
                                className="px-8 cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {isProcessing ? <LoadingSpinner size={16} className="mr-2" /> : null}
                                {file ? file.name : 'เลือกไฟล์ Excel'}
                            </Button>
                        </div>

                        <div className="mt-4 flex gap-4 text-xs text-slate-400">
                            <span>• รองรับหน่วย BT, CN, TR, CV, PA, CA</span>
                            <span>• เริ่มอ่านข้อมูลตั้งแต่แถวที่ 8</span>
                        </div>
                    </Card>

                    {previewData.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Summary Dashboard */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-l-blue-500">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">ทั้งหมด</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{importStats.total}</p>
                                </Card>
                                <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-l-green-500">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">เพิ่มใหม่</p>
                                    <p className="text-2xl font-bold text-green-600">{importStats.created}</p>
                                </Card>
                                <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-l-orange-500">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">อัปเดต</p>
                                    <p className="text-2xl font-bold text-orange-600">{importStats.updated}</p>
                                </Card>
                                <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-l-purple-500 overflow-hidden">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">หมวดหมู่หลัก</p>
                                    <div className="flex gap-1 mt-1 overflow-x-auto pb-1 scrollbar-hide">
                                        {Object.entries(importStats.categoryDistribution).slice(0, 3).map(([cat, count]) => (
                                            <Badge key={cat} variant="info" className="text-[10px] whitespace-nowrap">
                                                {cat}: {count}
                                            </Badge>
                                        ))}
                                        {Object.keys(importStats.categoryDistribution).length > 3 && (
                                            <Badge variant="info" className="text-[10px]">...</Badge>
                                        )}
                                    </div>
                                </Card>
                            </div>

                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    ตัวอย่างข้อมูล ({previewData.length} รายการ)
                                </h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => { setPreviewData([]); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} disabled={isProcessing}>
                                        ยกเลิก
                                    </Button>
                                    <Button onClick={startImport} disabled={isProcessing}>
                                        <CheckCircle size={18} className="mr-2" />
                                        ยืนยันการนำเข้าข้อมูล
                                    </Button>
                                </div>
                            </div>

                            <Card className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 min-w-[100px] sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">รหัส</th>
                                                <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 min-w-[200px] sticky left-[100px] bg-slate-50 dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-700">สินค้า (เก่า → ใหม่)</th>
                                                <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 min-w-[120px]">หมวดหมู่</th>
                                                <th className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">หน่วย</th>
                                                <th className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">สถานะ</th>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                                                    <th key={i} className="px-3 py-3 text-right font-bold text-slate-500 whitespace-nowrap">ราคา {i}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-3 py-3 font-mono text-[10px] sticky left-0 bg-white dark:bg-slate-800 z-10">{item.code}</td>
                                                    <td className="px-3 py-3 sticky left-[100px] bg-white dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700">
                                                        {renderDiff(item.isNew ? undefined : item.oldData?.name, item.name)}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {renderDiff(item.isNew ? undefined : item.oldData?.category, item.category)}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {renderDiff(item.isNew ? undefined : item.oldData?.unit, item.unit)}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {item.isNew ? (
                                                            <Badge variant="success" className="text-[10px]">เพิ่มใหม่</Badge>
                                                        ) : (
                                                            <Badge variant="info" className="text-[10px]">อัปเดต</Badge>
                                                        )}
                                                    </td>
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                                                        const pInfo = item.prices.find(p => p.level === level.toString());
                                                        const oldP = item.oldData?.prices[level.toString()];
                                                        return (
                                                            <td key={level} className="px-3 py-3 text-right border-l border-slate-50 dark:border-slate-800/50">
                                                                {renderPriceDiff(oldP, pInfo?.price || 0)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                {previewData.length > itemsPerPage && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <div className="text-sm text-slate-500">
                                            แสดง {(currentPage - 1) * itemsPerPage + 1} ถึง {Math.min(currentPage * itemsPerPage, previewData.length)} จาก {previewData.length} รายการ
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => prev - 1)}
                                                className="px-2"
                                            >
                                                <ChevronLeft size={16} />
                                            </Button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.ceil(previewData.length / itemsPerPage) }).map((_, i) => {
                                                    const pageNum = i + 1;
                                                    // Only show first, last, and pages around current
                                                    if (
                                                        pageNum === 1 ||
                                                        pageNum === Math.ceil(previewData.length / itemsPerPage) ||
                                                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                    ) {
                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                onClick={() => setCurrentPage(pageNum)}
                                                                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum
                                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                                    : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                                    }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    } else if (
                                                        pageNum === currentPage - 2 ||
                                                        pageNum === currentPage + 2
                                                    ) {
                                                        return <span key={pageNum} className="text-slate-400">...</span>;
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage === Math.ceil(previewData.length / itemsPerPage)}
                                                onClick={() => setCurrentPage(prev => prev + 1)}
                                                className="px-2"
                                            >
                                                <ChevronRight size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}

                    <div className="mt-8 w-full max-w-2xl mx-auto">
                        <button
                            onClick={() => setShowTemplateExample(!showTemplateExample)}
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium text-sm mb-4 mx-auto"
                        >
                            <FileText size={16} />
                            {showTemplateExample ? 'ซ่อนตัวอย่างโครงสร้างไฟล์' : 'ดูตัวอย่างโครงสร้างไฟล์ที่ถูกต้อง'}
                        </button>

                        {showTemplateExample && (
                            <Card className="overflow-hidden border-blue-100 dark:border-blue-900/30 bg-blue-50/10 dark:bg-blue-900/10 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-4 border-b border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/20">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Package size={16} />
                                        โครงสร้างไฟล์ Excel ที่รองรับ (ตัวอย่าง)
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        ข้อมูลควรเริ่มจากแถวที่ 8 เป็นต้นไป โดยมีหัวตารางดังนี้:
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-white/50 dark:bg-slate-800/50 text-slate-500 border-b border-blue-50 dark:border-blue-900/30">
                                            <tr>
                                                <th className="px-3 py-2">รหัสสินค้า</th>
                                                <th className="px-3 py-2">ชื่อสินค้า</th>
                                                <th className="px-3 py-2">หน่วย</th>
                                                <th className="px-3 py-2">ราคา 1</th>
                                                <th className="px-3 py-2">ราคา 2</th>
                                                <th className="px-3 py-2">...</th>
                                                <th className="px-3 py-2">ราคา 9</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-50 dark:divide-blue-900/20 text-slate-700 dark:text-slate-300">
                                            <tr className="bg-white/20">
                                                <td className="px-3 py-2 font-mono">SKU001</td>
                                                <td className="px-3 py-2">เบียร์สิงห์ 620ml</td>
                                                <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">BT</td>
                                                <td className="px-3 py-2">550.00</td>
                                                <td className="px-3 py-2">545.00</td>
                                                <td className="px-3 py-2 text-slate-400">...</td>
                                                <td className="px-3 py-2">530.00</td>
                                            </tr>
                                            <tr className="bg-white/20">
                                                <td className="px-3 py-2 font-mono">SKU002</td>
                                                <td className="px-3 py-2">น้ำดื่มสิงห์ 1.5L</td>
                                                <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">CV</td>
                                                <td className="px-3 py-2">120.00</td>
                                                <td className="px-3 py-2">118.00</td>
                                                <td className="px-3 py-2 text-slate-400">...</td>
                                                <td className="px-3 py-2">110.00</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 bg-white/40 dark:bg-slate-800/40 border-t border-blue-50 dark:border-blue-900/30 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">รหัสหน่วยที่รองรับ</p>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(UNIT_MAP).map(([code, Thai]) => (
                                                <Badge key={code} variant="info" className="text-[9px] py-0 px-1 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900">
                                                    {code}: {Thai}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                        <p className="font-bold mb-1">หมายเหตุ:</p>
                                        <ul className="list-disc ml-4 space-y-0.5">
                                            <li>ชื่อคอลัมน์ราคาต้องเป็น [ราคา 1] ถึง [ราคา 9]</li>
                                            <li>ราคาสามารถมีทศนิยมได้</li>
                                            <li>รหัสสินค้าจะเป็นเงื่อนไขในการ Update ข้อมูล</li>
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
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
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                                            <th className="px-4 py-3 text-left font-bold">วัน / เวลา นำเข้า</th>
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

            {/* Import Progress Modal */}
            <Modal
                isOpen={isImporting}
                onClose={() => { }} // Disable closing during import
                title="กำลังนำเข้าข้อมูล..."
                size="small"
            >
                <div className="py-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        ระบบกำลังบันทึกข้อมูลสินค้าและราคาทั้ง 9 ระดับ กรุณารอสักครู่...
                    </p>
                    <Progress
                        value={importProgress}
                        label={`สำเร็จแล้ว ${Math.round((importProgress / 100) * previewData.length)} จาก ${previewData.length} รายการ`}
                    />
                    <div className="mt-8 flex items-center justify-center text-xs text-slate-400 animate-pulse">
                        <LoadingSpinner size={12} className="mr-2" />
                        ห้ามปิดหน้าจอนี้จนกว่าจะเสร็จสิ้น
                    </div>
                </div>
            </Modal>
        </PageLayout>
    );
}
