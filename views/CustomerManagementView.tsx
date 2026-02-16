import React, { useMemo, useState, useEffect } from 'react';
import { Users, Edit2, Search, AlertCircle, ChevronLeft, ChevronRight, Trash2, Plus } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useStores } from '../hooks/useStores';
import { storeService } from '../services/storeService';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks';

export function CustomerManagementView() {
  const { isSales, isAdmin, isManager, isExecutive, isInspector, profile } = useAuth();
  const isHighLevel = isAdmin || isManager || isExecutive || isInspector;
  const userBranch = profile?.branch || 'HQ';

  const [searchTerm, setSearchTerm] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [branchFilter, setBranchFilter] = useState<'ALL' | 'HQ' | 'SD'>(() => {
    if (isHighLevel || userBranch === 'HQ') return 'ALL';
    return userBranch as 'SD';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Calculate pagination offset
  const offset = (currentPage - 1) * itemsPerPage;

  const filters = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      is_active: onlyActive ? true : undefined,
      branch: branchFilter === 'ALL' ? undefined : branchFilter,
      limit: itemsPerPage,
      offset: offset,
    }),
    [searchTerm, onlyActive, branchFilter, itemsPerPage, offset],
  );

  const { stores, totalCount, loading, error, refetch } = useStores(filters);
  const { showNotification } = useNotification();

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, onlyActive, branchFilter, itemsPerPage]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const startIndex = offset;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);

  // Restrict access to Sales & Admin only (ตาม requirement)
  if (!isSales && !isAdmin) {
    return (
      <PageLayout title="จัดการลูกค้า">
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-12 h-12 mb-3 text-amber-500" />
          <p className="text-lg font-medium">คุณไม่มีสิทธิ์เข้าถึงหน้าจอนี้</p>
          <p className="text-sm mt-1">หน้าจอนี้จำกัดเฉพาะผู้ใช้งานฝ่ายขายและผู้ดูแลระบบ (Sales, Admin)</p>
        </div>
      </PageLayout>
    );
  }

  const handleOpenEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      customer_code: customer.customer_code,
      customer_name: customer.customer_name,
      branch: customer.branch || 'HQ',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      contact_person: customer.contact_person || '',
      notes: customer.notes || '',
      is_active: customer.is_active ?? true,
      tier_id: customer.tier_id || null,
    });
  };

  const handleOpenCreate = () => {
    setEditingCustomer({ id: null });
    setFormData({
      customer_code: '',
      customer_name: '',
      branch: branchFilter === 'ALL' ? 'HQ' : branchFilter,
      address: '',
      phone: '',
      email: '',
      contact_person: '',
      notes: '',
      is_active: true,
      tier_id: null,
    });
  };

  const handleCloseEdit = () => {
    setEditingCustomer(null);
    setFormData({});
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      setSaving(true);

      // Normalize branch: support Thai names but save as code (HQ / SD)
      let branch = formData.branch || 'HQ';
      if (typeof branch === 'string') {
        const b = branch.toUpperCase();
        if (b.includes('สอยดาว') || b === 'SD') {
          branch = 'SD';
        } else if (b.includes('สำนักงาน') || b === 'HQ') {
          branch = 'HQ';
        }
      }

      if (!formData.customer_name || !formData.customer_code) {
        showNotification('warning', 'กรุณากรอกรหัสลูกค้าและชื่อลูกค้าให้ครบถ้วน');
        setSaving(false);
        return;
      }

      if (editingCustomer.id) {
        // Update existing customer
        const payload: any = {
          customer_name: formData.customer_name,
          branch,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          contact_person: formData.contact_person || null,
          notes: formData.notes || null,
          is_active: !!formData.is_active,
          tier_id: formData.tier_id || null,
        };

        await storeService.update(editingCustomer.id, payload);
        showNotification('success', 'บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว');
      } else {
        // Create new customer
        const createPayload: any = {
          customer_code: String(formData.customer_code).trim(),
          customer_name: String(formData.customer_name).trim(),
          branch,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          contact_person: formData.contact_person || null,
          notes: formData.notes || null,
          is_active: !!formData.is_active,
          tier_id: formData.tier_id || null,
        };

        await storeService.create(createPayload);
        showNotification('success', 'เพิ่มลูกค้าใหม่เรียบร้อยแล้ว');
      }

      handleCloseEdit();
      await refetch();
    } catch (err: any) {
      console.error('[CustomerManagementView] Failed to update customer:', err);
      showNotification('error', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = stores.filter((s: any) => s.is_active).length;

  return (
    <PageLayout title="จัดการลูกค้า">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex-1 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="พิมพ์ชื่อร้านค้าหรือรหัสลูกค้าเพื่อค้นหา..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:border-enterprise-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs md:text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-enterprise-500 focus:ring-enterprise-500"
            />
            แสดงเฉพาะลูกค้าที่ใช้งานอยู่
          </label>
        </div>
        <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500 dark:text-slate-400">
          <Badge variant="info">
            ทั้งหมด {totalCount.toLocaleString('th-TH')} ราย
          </Badge>
          {!onlyActive && (
            <Badge variant="success">
              ใช้งานอยู่ {activeCount.toLocaleString('th-TH')} ราย
            </Badge>
          )}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value as 'ALL' | 'HQ' | 'SD')}
            className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-enterprise-500 disabled:opacity-50"
            disabled={!(isHighLevel || userBranch === 'HQ')}
          >
            {(isHighLevel || userBranch === 'HQ') && <option value="ALL">ทุกสาขา</option>}
            {(isHighLevel || userBranch === 'HQ') && <option value="HQ">สำนักงานใหญ่ (HQ)</option>}
            <option value="SD">สาขาสอยดาว (SD)</option>
          </select>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
          >
            <option value={20}>20 รายการ/หน้า</option>
            <option value={50}>50 รายการ/หน้า</option>
            <option value={100}>100 รายการ/หน้า</option>
          </select>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มลูกค้า</span>
          </Button>
        </div>
      </div>

      {/* Loading / Error / Empty states */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {!loading && error && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
            <AlertCircle className="w-10 h-10 mb-3 text-red-500" />
            <p className="font-medium mb-1">โหลดข้อมูลลูกค้าไม่สำเร็จ</p>
            <p className="text-xs md:text-sm mb-4">
              {error.message || 'กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ'}
            </p>
            <Button size="sm" onClick={() => refetch()}>
              ลองใหม่
            </Button>
          </div>
        </Card>
      )}

      {!loading && !error && stores.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
            <Users className="w-14 h-14 mb-4 opacity-60" />
            <p className="text-lg font-medium">ไม่พบลูกค้า</p>
            <p className="text-sm mt-1">
              ลองเปลี่ยนคำค้นหาหรือยกเลิกตัวกรอง &quot;เฉพาะลูกค้าที่ใช้งานอยู่&quot;
            </p>
          </div>
        </Card>
      )}

      {/* Customer list */}
      {!loading && !error && stores.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    รหัสลูกค้า
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    ชื่อลูกค้า
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    สาขา
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    ผู้ติดต่อ
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    โทรศัพท์
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    สถานะ
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store: any) => (
                  <tr
                    key={store.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs md:text-sm text-slate-700 dark:text-slate-200">
                      {store.customer_code}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[220px] md:max-w-xs" title={store.customer_name}>
                          {store.customer_name}
                        </span>
                        {store.tier_name && (
                          <Badge variant="info" className="hidden md:inline-flex">
                            {store.tier_name}
                          </Badge>
                        )}
                      </div>
                      {store.address && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 md:line-clamp-2">
                          {store.address}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge
                        className={
                          store.branch === 'SD'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                        }
                      >
                        {store.branch === 'SD' ? 'สาขาสอยดาว (SD)' : 'สำนักงานใหญ่ (HQ)'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[160px]" title={store.contact_person || ''}>
                          {store.contact_person || '-'}
                        </span>
                        {store.email && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                            {store.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200">
                      {store.phone || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant={store.is_active ? 'success' : 'warning'}>
                        {store.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(store)}
                        className="inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>แก้ไข</span>
                      </Button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isAdmin && !isSales) return;
                          if (!confirm(`ต้องการลบลูกค้า "${store.customer_name}" (${store.customer_code}) ใช่หรือไม่?`)) {
                            return;
                          }
                          try {
                            await storeService.delete(store.id);
                            showNotification('success', 'ลบลูกค้าเรียบร้อยแล้ว');
                            await refetch();
                          } catch (err: any) {
                            console.error('[CustomerManagementView] Failed to delete customer:', err);
                            showNotification('error', err.message || 'เกิดข้อผิดพลาดในการลบลูกค้า');
                          }
                        }}
                        className="ml-2 inline-flex items-center justify-center p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="ลบลูกค้า"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                แสดง {startIndex + 1} - {endIndex} จาก {totalCount.toLocaleString('th-TH')} รายการ
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  ก่อนหน้า
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(() => {
                    const pages: (number | string)[] = [];

                    // For small number of pages, show all
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Always show first page
                      pages.push(1);

                      // Calculate range around current page (show 2 pages on each side)
                      const startPage = Math.max(2, currentPage - 2);
                      const endPage = Math.min(totalPages - 1, currentPage + 2);

                      // Add ellipsis if needed before current range
                      if (startPage > 2) {
                        pages.push('ellipsis-start');
                      }

                      // Add pages around current page
                      for (let i = startPage; i <= endPage; i++) {
                        if (i !== 1 && i !== totalPages) {
                          pages.push(i);
                        }
                      }

                      // Add ellipsis if needed after current range
                      if (endPage < totalPages - 1) {
                        pages.push('ellipsis-end');
                      }

                      // Always show last page
                      pages.push(totalPages);
                    }

                    return pages.map((page) => {
                      if (typeof page === 'string') {
                        return (
                          <span key={page} className="px-2 text-slate-400">
                            ...
                          </span>
                        );
                      }

                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                              ? 'bg-enterprise-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                          {page.toLocaleString('th-TH')}
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* Jump to Page Input (for large page counts) */}
                {totalPages > 10 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">ไปที่หน้า:</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const page = parseInt(pageInput);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page);
                            setPageInput('');
                          }
                        }
                      }}
                      placeholder={`1-${totalPages}`}
                      className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const page = parseInt(pageInput);
                        if (page >= 1 && page <= totalPages) {
                          setCurrentPage(page);
                          setPageInput('');
                        }
                      }}
                    >
                      ไป
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="flex items-center gap-1"
                >
                  ถัดไป
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Edit Customer Modal */}
      <Modal
        isOpen={!!editingCustomer}
        onClose={handleCloseEdit}
        title={
          editingCustomer?.id
            ? `แก้ไขลูกค้า: ${editingCustomer.customer_code || ''}`
            : 'เพิ่มลูกค้าใหม่'
        }
      >
        {editingCustomer && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  รหัสลูกค้า
                </label>
                <input
                  type="text"
                  value={formData.customer_code || ''}
                  onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                  disabled={!!editingCustomer?.id}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${editingCustomer?.id
                      ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                    }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  ชื่อลูกค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer_name || ''}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  สาขา (Branch)
                </label>
                <select
                  value={formData.branch || 'HQ'}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 disabled:opacity-60"
                  disabled={!(isHighLevel || userBranch === 'HQ')}
                >
                  {(isHighLevel || userBranch === 'HQ') && <option value="HQ">สำนักงานใหญ่ (HQ)</option>}
                  <option value="SD">สาขาสอยดาว (SD)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  การเปลี่ยนค่านี้จะส่งผลกับการคำนวณสาขาของออเดอร์ใหม่ที่สร้างจากลูกค้ารายนี้
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  ผู้ติดต่อ
                </label>
                <input
                  type="text"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                ที่อยู่
              </label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  โทรศัพท์
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                หมายเหตุภายใน
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={!!formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-enterprise-500 focus:ring-enterprise-500"
                />
                ลูกค้ายังใช้งานอยู่ (Active)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button type="button" variant="outline" onClick={handleCloseEdit} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </PageLayout>
  );
}

