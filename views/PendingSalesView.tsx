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
  Search,
  CheckSquare,
  Square,
  Play,
  CheckCircle2
} from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuth, useToast } from '../hooks';
import { incompleteOrdersService, IncompleteOrder } from '../services/incompleteOrdersService';
import { orderUploadService, UploadedOrder } from '../services/orderUploadService';
import { ordersService } from '../services/ordersService';
import { ToastContainer } from '../components/ui/Toast';

interface PendingSalesViewProps {
  onBack?: () => void;
}

export const PendingSalesView: React.FC<PendingSalesViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<IncompleteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = useState(false);
  const [isProcessSelectedOpen, setIsProcessSelectedOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toasts, dismissToast, success, error, warning, info } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await incompleteOrdersService.getAll();
      setOrders(data);
      setSelectedIds([]);
    } catch (err: any) {
      error('ไม่สามารถโหลดข้อมูลได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  const handleDelete = (id: string) => {
    setOrderToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    
    try {
      await incompleteOrdersService.delete(orderToDelete);
      success('ลบรายการเรียบร้อย');
      fetchOrders();
    } catch (err: any) {
      error('ลบไม่สำเร็จ: ' + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const confirmDeleteAll = async () => {
    try {
      setLoading(true);
      await incompleteOrdersService.deleteAll();
      success('ลบรายการทั้งหมดเรียบร้อยแล้ว');
      fetchOrders();
    } catch (err: any) {
      error('ลบไม่สำเร็จ: ' + err.message);
    } finally {
      setIsDeleteAllOpen(false);
      setLoading(false);
    }
  };

  const confirmDeleteSelected = async () => {
    try {
      setLoading(true);
      let successCount = 0;
      for (const id of selectedIds) {
        await incompleteOrdersService.delete(id);
        successCount++;
      }
      success(`ลบ ${successCount} รายการเรียบร้อยแล้ว`);
      fetchOrders();
    } catch (err: any) {
      error('ลบไม่สำเร็จบางรายการ: ' + err.message);
      fetchOrders();
    } finally {
      setIsDeleteSelectedOpen(false);
      setLoading(false);
    }
  };

  const confirmProcessSelected = async () => {
    const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
    if (selectedOrders.length === 0) return;

    setIsProcessSelectedOpen(false);
    setLoading(true);
    info(`กำลังประมวลผล ${selectedOrders.length} รายการ...`);

    try {
      // 1. Map to UploadedOrder format for validation
      const uploadFormatOrders: UploadedOrder[] = selectedOrders.map(o => ({
        order_date: o.order_date,
        doc_no: o.doc_no,
        time: '',
        customer_name: o.customer_name,
        customer_code: o.customer_code,
        doc_type: 'ใบสั่งขาย',
        status: 'รอประมวลผล',
        tax_exempt: 0,
        tax_rate: 7,
        vat: 0,
        tax_type: 'แยกนอก',
        net_value: o.net_value,
        items: o.items.map(i => ({
          product_code: i.product_code,
          product_name: i.product_name,
          unit: i.unit,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: 0,
          total: i.quantity * i.unit_price,
          required_date: o.order_date
        }))
      }));

      // 2. Validate against current database
      const validatedOrders = await orderUploadService.validateOrders(uploadFormatOrders);

      let createdCount = 0;
      let failedCount = 0;
      let errorMsgs: string[] = [];

      // 3. Process each validated order
      for (let i = 0; i < validatedOrders.length; i++) {
        const validated = validatedOrders[i];
        const original = selectedOrders[i];

        if (validated.error) {
          failedCount++;
          errorMsgs.push(`${validated.doc_no}: ${validated.error}`);
          // Update error message in DB for visibility
          await incompleteOrdersService.update(original.id, { error_message: validated.error });
          continue;
        }

        // It's valid now! Create real order
        try {
          const orderInsert = {
            order_number: validated.doc_no,
            store_id: validated.store_id!,
            order_date: validated.order_date,
            status: 'awaiting_confirmation',
            notes: `(นำเข้าจากใบขายคงค้าง)`,
            created_by: profile?.id,
            warehouse_id: original.warehouse_id,
          };

          const itemsToSubmit = validated.items.map(item => ({
            product_id: item.product_id!,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: 0,
            is_bonus: item.unit_price === 0,
            fulfillment_method: 'delivery' as const,
          }));

          await ordersService.createWithItems(orderInsert, itemsToSubmit, null, null);
          
          // Delete from incomplete orders
          await incompleteOrdersService.delete(original.id);
          createdCount++;
        } catch (err: any) {
          failedCount++;
          errorMsgs.push(`${validated.doc_no}: ${err.message}`);
        }
      }

      if (createdCount > 0) success(`นำเข้าสำเร็จ ${createdCount} รายการ`);
      if (failedCount > 0) {
        warning(`นำเข้าไม่สำเร็จ ${failedCount} รายการ (ตรวจสอบสาเหตุในรายการ)`);
        console.log('Processing errors:', errorMsgs);
      }
      
      fetchOrders();
    } catch (err: any) {
      error('เกิดข้อผิดพลาดในการประมวลผล: ' + err.message);
    } finally {
      setLoading(false);
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
      
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="ยืนยันการลบรายการ"
        message="คุณต้องการลบรายการนี้ใช่หรือไม่? หลังจากลบแล้วจะไม่สามารถกู้คืนได้ (ควรลบหลังจากแก้ไขใน SML และอัพโหลดใหม่สำเร็จแล้ว)"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isDeleteSelectedOpen}
        title="ยืนยันการลบที่เลือก"
        message={`คุณต้องการลบรายการที่เลือกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`}
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        onConfirm={confirmDeleteSelected}
        onCancel={() => setIsDeleteSelectedOpen(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isProcessSelectedOpen}
        title="ประมวลผลรายการที่เลือก"
        message={`คุณต้องการนำเข้าข้อมูลที่เลือกจำนวน ${selectedIds.length} รายการใหม่อีกครั้งใช่หรือไม่? (ระบบจะตรวจสอบข้อมูลล่าสุดในฐานข้อมูล)`}
        confirmText="เริ่มประมวลผล"
        cancelText="ยกเลิก"
        onConfirm={confirmProcessSelected}
        onCancel={() => setIsProcessSelectedOpen(false)}
        variant="info"
      />

      <PageLayout
        title="ใบขายคงค้าง (ที่มีข้อผิดพลาด)"
        onBack={onBack}
        actions={
          <div className="flex items-center gap-2">
            {orders.length > 0 && (
                <Button 
                    onClick={() => setIsDeleteAllOpen(true)} 
                    variant="ghost" 
                    size="sm" 
                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                    <Trash2 className="w-4 h-4" />
                    ลบทั้งหมด
                </Button>
            )}
            <Button onClick={fetchOrders} variant="outline" size="sm" className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                รีเฟรช
            </Button>
          </div>
        }
      >
        <div className="mb-6 flex flex-col gap-4">
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

            {filteredOrders.length > 0 && (
                <div className="flex items-center justify-between px-2">
                    <button 
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors"
                    >
                        {selectedIds.length === filteredOrders.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                        {selectedIds.length === filteredOrders.length ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                    <span className="text-sm text-gray-500">พบ {filteredOrders.length} รายการ</span>
                </div>
            )}
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
          <div className="space-y-4 pb-24">
            {filteredOrders.map((order) => (
              <Card key={order.id} className={`overflow-hidden border-l-4 transition-all ${selectedIds.includes(order.id) ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-l-red-500 hover:shadow-md'}`}>
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button 
                        onClick={(e) => toggleSelect(order.id, e)}
                        className="mt-1 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        {selectedIds.includes(order.id) ? (
                            <CheckSquare className="w-6 h-6 text-blue-500" />
                        ) : (
                            <Square className="w-6 h-6 text-gray-400" />
                        )}
                      </button>

                      <div className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
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
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-400 italic">ตรวจสอบรายการสินค้าและแก้ไขใน SML</span>
                        </div>
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

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 duration-300">
                <Card className="flex items-center gap-4 px-6 py-4 bg-slate-900 dark:bg-slate-800 text-white shadow-2xl rounded-2xl border-0">
                    <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                        <span className="font-bold">เลือก {selectedIds.length} รายการ</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={() => setIsProcessSelectedOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white border-0 flex items-center gap-2 px-6"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            นำเข้าใหม่อีกครั้ง
                        </Button>
                        
                        <Button 
                            onClick={() => setIsDeleteSelectedOpen(true)}
                            variant="outline"
                            className="bg-transparent border-slate-700 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 text-slate-300"
                        >
                            <Trash2 className="w-4 h-4" />
                            ลบที่เลือก
                        </Button>

                        <Button 
                            onClick={() => setSelectedIds([])}
                            variant="ghost"
                            className="text-slate-400 hover:text-white"
                        >
                            ยกเลิก
                        </Button>
                    </div>
                </Card>
            </div>
        )}
      </PageLayout>
    </>
  );
};
