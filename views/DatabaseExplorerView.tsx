import React, { useState, useEffect } from 'react';
import {
    Database,
    Search,
    RefreshCw,
    Download,
    ChevronRight,
    Table as TableIcon,
    Filter,
    Eye,
    X,
    FileJson
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../hooks/useToast';

interface TableInfo {
    name: string;
    category: string;
}

const TABLES: TableInfo[] = [
    // Logistics
    { name: 'vehicles', category: 'Logistics' },
    { name: 'tickets', category: 'Logistics' },
    { name: 'trip_logs', category: 'Logistics' },
    { name: 'fuel_records', category: 'Logistics' },
    { name: 'delivery_trips', category: 'Logistics' },
    { name: 'delivery_trip_items', category: 'Logistics' },
    { name: 'stores', category: 'Logistics' },

    // Sales & Product
    { name: 'products', category: 'Sales & Product' },
    { name: 'product_categories', category: 'Sales & Product' },
    { name: 'product_tier_prices', category: 'Sales & Product' },
    { name: 'customer_tiers', category: 'Sales & Product' },

    // Inventory
    { name: 'inventory', category: 'Inventory' },
    { name: 'warehouses', category: 'Inventory' },

    // System
    { name: 'profiles', category: 'System' },
    { name: 'ticket_approvals', category: 'System' },
    { name: 'ticket_costs', category: 'System' },
];

export const DatabaseExplorerView = () => {
    const [selectedTable, setSelectedTable] = useState<string>(TABLES[0].name);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [tableSearch, setTableSearch] = useState('');
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const { error: toastError } = useToast();

    const fetchData = async (tableName: string) => {
        setLoading(true);
        try {
            const { data: result, error } = await supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setData(result || []);
        } catch (error: any) {
            toastError('Error fetching data: ' + error.message);
            // Fallback if no created_at
            try {
                const { data: result, error: error2 } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(100);
                if (error2) throw error2;
                setData(result || []);
            } catch (e) {
                setData([]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedTable);
    }, [selectedTable]);

    const filteredData = data.filter(row =>
        Object.values(row).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const filteredTables = TABLES.filter(t =>
        t.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        t.category.toLowerCase().includes(tableSearch.toLowerCase())
    );

    const exportToCSV = () => {
        if (filteredData.length === 0) return;

        const headers = Object.keys(filteredData[0]).join(',');
        const rows = filteredData.map(row =>
            Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        );

        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedTable}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const categories = Array.from(new Set(TABLES.map(t => t.category)));

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6 animate-in fade-in duration-500">
            {/* Sidebar - Table List */}
            <Card className="w-72 flex flex-col overflow-hidden border-slate-200 dark:border-slate-800">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-enterprise-500 outline-none transition-all"
                            placeholder="ค้นหาตาราง..."
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                    {categories.map(category => {
                        const tableInCategory = filteredTables.filter(t => t.category === category);
                        if (tableInCategory.length === 0) return null;

                        return (
                            <div key={category} className="space-y-1">
                                <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{category}</p>
                                {tableInCategory.map(table => (
                                    <button
                                        key={table.name}
                                        onClick={() => setSelectedTable(table.name)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${selectedTable === table.name
                                            ? 'bg-enterprise-50 text-enterprise-600 dark:bg-enterprise-900/30 dark:text-enterprise-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <TableIcon size={14} className={selectedTable === table.name ? 'text-enterprise-500' : 'text-slate-400'} />
                                            <span>{table.name}</span>
                                        </div>
                                        {selectedTable === table.name && <ChevronRight size={14} />}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Main Content - Data Grid */}
            <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-enterprise-50 dark:bg-enterprise-950 rounded-lg">
                            <Database className="text-enterprise-600 dark:text-enterprise-400" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTable}</h2>
                            <p className="text-xs text-slate-500">แสดงข้อมูล 100 รายการล่าสุด</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative mr-2">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm min-w-[200px] focus:ring-2 focus:ring-enterprise-500 outline-none"
                                placeholder="กรองข้อมูลในหน้านี้..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => fetchData(selectedTable)} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={loading || filteredData.length === 0}>
                            <Download size={16} />
                            <span className="ml-2 hidden sm:inline">Export CSV</span>
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto relative">
                    {loading ? (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10 backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-3">
                                <RefreshCw size={32} className="animate-spin text-enterprise-600" />
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">กำลังโหลดข้อมูล...</p>
                            </div>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                            <TableIcon size={48} className="mb-4 opacity-20" />
                            <p>ไม่พบข้อมูลในตารางนี้</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Actions</th>
                                    {Object.keys(filteredData[0]).map(key => (
                                        <th key={key} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredData.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                            <button
                                                onClick={() => setSelectedRow(row)}
                                                className="p-1.5 text-slate-400 hover:text-enterprise-600 hover:bg-enterprise-50 rounded-md transition-all"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                        {Object.values(row).map((val, j) => (
                                            <td key={j} className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 max-w-xs truncate">
                                                {typeof val === 'object' && val !== null
                                                    ? <span className="flex items-center gap-1 text-[10px] py-0.5 px-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full font-mono w-fit"><FileJson size={10} /> JSON</span>
                                                    : String(val)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            {/* Detail Modal */}
            {selectedRow && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 sm:p-10 animate-in fade-in duration-200">
                    <Card className="w-full max-w-3xl max-h-full overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border-none ring-1 ring-white/10">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-enterprise-100 dark:bg-enterprise-900/50 rounded-lg flex items-center justify-center text-enterprise-600 dark:text-enterprise-400">
                                    <Eye size={18} />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white">ข้อมูลแถวแบบละเอียด</h3>
                            </div>
                            <button
                                onClick={() => setSelectedRow(null)}
                                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-slate-900">
                            <div className="grid grid-cols-1 gap-4">
                                {Object.entries(selectedRow).map(([key, value]) => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{key}</label>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 font-mono text-sm break-all">
                                            {typeof value === 'object' && value !== null
                                                ? <pre className="whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>
                                                : String(value)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                            <Button onClick={() => setSelectedRow(null)}>ปิดหน้าต่าง</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
