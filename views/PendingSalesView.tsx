import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Trash2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Package, 
  Calendar, 
  User, 
  Search
} from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks';
import { incompleteOrdersService, IncompleteOrder } from '../services/incompleteOrdersService';
import { ToastContainer } from '../components/ui/Toast';

interface PendingSalesViewProps {
  onBack?: () => void;
}

export const PendingSalesView: React.FC<PendingSalesViewProps> = ({ onBack }) => {
  const [orders, setOrders] = useState<IncompleteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toasts, dismissToast, success, error, warning } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await incompleteOrdersService.getAll();
      setOrders(data);
    } catch (err: any) {
      error('ไม่สามารถโหลดข้อมูลได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่? หลังจากลบแล้วจะไม่สามารถกู้คืนได้ (ควรลบหลังจากแก้ไขใน SML และอัพโหลดใหม่สำเร็จแล้ว)')) return;
    
    try {
      await incompleteOrdersService.delete(id);
      success('ลบรายการเรียบร้อย');
      fetchOrders();
    } catch (err: any) {
      error('ลบไม่สำเร็จ: ' + err.message);
    }
  };

  const filteredOrders = orders.filter(order => 
    order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.doc_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout
        title="ใบขายคงค้าง (ที่มีข้อผิดพลาด)"
        onBack={onBack}
        actions={
          <Button onClick={fetchOrders} variant="outline" size="sm" className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        }
      >
        <div className="mb-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="ค้นหา เลขที่เอกสาร, ชื่อร้านค้า, รหัสร้านค้า..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
            </div>
        </div>

        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-gray-400">
              <FileText size={64} className="opacity-10" />
              <p className="text-lg">ไม่พบรายการคงค้าง</p>
              {searchTerm && <p className="text-sm">ลองเปลี่ยนคำค้นหาดูใหม่</p>}
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                            {order.customer_name}
                          </h3>
                          <Badge variant="outline" className="text-xs bg-white dark:bg-slate-900 font-mono">
                            {order.doc_no}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                           <Badge className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs border-red-100 dark:border-red-900/50">
                            {order.error_message}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 opacity-70" />
                            {new Date(order.order_date).toLocaleDateString('th-TH', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                            })}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono">
                            <User className="w-4 h-4 opacity-70" />
                            {order.customer_code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                          ฿{order.net_value.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-500 flex items-center justify-end gap-1">
                          <Package className="w-4 h-4" />
                          {order.items.length} รายการ
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(order.id);
                          }}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2 h-auto"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                        <div className="p-1">
                           {expandedId === order.id ? (
                                <ChevronUp className="w-6 h-6 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-6 h-6 text-gray-400" />
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="px-6 pb-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                           <Package className="w-4 h-4" />
                           รายการสินค้าในเอกสาร
                        </h4>
                        <span className="text-xs text-gray-400 italic">ตรวจสอบรายการสินค้าและแก้ไขใน SML</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                <Package className="w-5 h-5" />
                                </div>
                                <div>
                                <p className="font-bold text-gray-900 dark:text-white">{item.product_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.product_code}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-gray-900 dark:text-white">
                                {item.quantity.toLocaleString()} {item.unit}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full mt-1">
                                @ ฿{item.unit_price.toLocaleString()}
                                </p>
                            </div>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </PageLayout>
    </>
  );
};
