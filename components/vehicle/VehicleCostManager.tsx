// VehicleCostManager — Card ต้นทุนคงที่ + ต้นทุนผันแปร พร้อมโมดัลเพิ่ม/แก้/ลบ (Phase 3)
import React, { useState } from 'react';
import { DollarSign, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FixedCostModal } from './FixedCostModal';
import { VariableCostModal } from './VariableCostModal';
import { useVehicleCosts } from '../../hooks/useVehicleCosts';
import { useDeliveryTrips } from '../../hooks/useDeliveryTrips';
import { vehicleCostService } from '../../services/vehicleCostService';
import type { Database } from '../../types/database';
import { useToast } from '../../hooks/useToast';

type VehicleFixedCostRow = Database['public']['Tables']['vehicle_fixed_costs']['Row'];
type VehicleVariableCostRow = Database['public']['Tables']['vehicle_variable_costs']['Row'];

interface VehicleCostManagerProps {
  vehicleId: string;
  canEdit?: boolean;
}

export const VehicleCostManager: React.FC<VehicleCostManagerProps> = ({
  vehicleId,
  canEdit = false,
}) => {
  const { success, error: showError } = useToast();
  const { fixedCosts, variableCosts, loading, error, refetch } = useVehicleCosts({
    vehicleId,
    autoFetch: true,
  });
  const { trips } = useDeliveryTrips({
    vehicle_id: vehicleId,
    autoFetch: true,
    pageSize: 100,
    sortAscending: false,
  });

  const [fixedModalOpen, setFixedModalOpen] = useState(false);
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [editFixed, setEditFixed] = useState<VehicleFixedCostRow | null>(null);
  const [editVariable, setEditVariable] = useState<VehicleVariableCostRow | null>(null);
  const [deleteFixedOpen, setDeleteFixedOpen] = useState(false);
  const [deleteVariableOpen, setDeleteVariableOpen] = useState(false);
  const [costToDelete, setCostToDelete] = useState<{ type: 'fixed' | 'variable'; id: string; label: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddFixed = () => {
    setEditFixed(null);
    setFixedModalOpen(true);
  };
  const handleEditFixed = (row: VehicleFixedCostRow) => {
    setEditFixed(row);
    setFixedModalOpen(true);
  };
  const handleFixedSuccess = () => {
    refetch();
    success('บันทึกต้นทุนคงที่แล้ว');
  };

  const handleAddVariable = () => {
    setEditVariable(null);
    setVariableModalOpen(true);
  };
  const handleEditVariable = (row: VehicleVariableCostRow) => {
    setEditVariable(row);
    setVariableModalOpen(true);
  };
  const handleVariableSuccess = () => {
    refetch();
    success('บันทึกต้นทุนผันแปรแล้ว');
  };

  const handleDeleteFixedClick = (row: VehicleFixedCostRow) => {
    setCostToDelete({ type: 'fixed', id: row.id, label: `${row.cost_type} ${row.amount.toLocaleString()} บาท` });
    setDeleteFixedOpen(true);
  };
  const handleDeleteVariableClick = (row: VehicleVariableCostRow) => {
    setCostToDelete({ type: 'variable', id: row.id, label: `${row.cost_type} ${row.amount.toLocaleString()} บาท` });
    setDeleteVariableOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!costToDelete) return;
    setDeletingId(costToDelete.id);
    try {
      if (costToDelete.type === 'fixed') {
        await vehicleCostService.deleteFixedCost(costToDelete.id);
        setDeleteFixedOpen(false);
      } else {
        await vehicleCostService.deleteVariableCost(costToDelete.id);
        setDeleteVariableOpen(false);
      }
      refetch();
      success('ลบรายการแล้ว');
    } catch (err: any) {
      showError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
      setCostToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteFixedOpen(false);
    setDeleteVariableOpen(false);
    setCostToDelete(null);
  };

  if (loading && fixedCosts.length === 0 && variableCosts.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-600" />
          <span className="ml-3 text-slate-600 dark:text-slate-400">กำลังโหลดต้นทุน...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 dark:text-red-400 mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>ลองอีกครั้ง</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            ต้นทุนคงที่ และ ต้นทุนผันแปร
          </h2>
        </div>

        {/* ต้นทุนคงที่ */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">ต้นทุนคงที่</h3>
            {canEdit && (
              <Button size="sm" onClick={handleAddFixed}>
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มรายการ
              </Button>
            )}
          </div>
          {fixedCosts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">ยังไม่มีรายการต้นทุนคงที่</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">ประเภท</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">จำนวน (บาท)</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">ช่วง</th>
                    {canEdit && <th className="px-3 py-2 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {fixedCosts.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-3 py-2 text-slate-900 dark:text-white">{row.cost_type}</td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{row.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {row.period_start?.split('T')[0]} — {row.period_end ? row.period_end.split('T')[0] : '-'}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleEditFixed(row)} title="แก้ไข">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteFixedClick(row)} disabled={deletingId === row.id} title="ลบ">
                              {deletingId === row.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ต้นทุนผันแปร */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">ต้นทุนผันแปร</h3>
            {canEdit && (
              <Button size="sm" onClick={handleAddVariable}>
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มรายการ
              </Button>
            )}
          </div>
          {variableCosts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">ยังไม่มีรายการต้นทุนผันแปร</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">ประเภท</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">จำนวน (บาท)</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">วันที่</th>
                    {canEdit && <th className="px-3 py-2 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {variableCosts.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-3 py-2 text-slate-900 dark:text-white">{row.cost_type}</td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{row.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.cost_date?.split('T')[0]}</td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleEditVariable(row)} title="แก้ไข">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteVariableClick(row)} disabled={deletingId === row.id} title="ลบ">
                              {deletingId === row.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <FixedCostModal
        isOpen={fixedModalOpen}
        onClose={() => { setFixedModalOpen(false); setEditFixed(null); }}
        vehicleId={vehicleId}
        editRow={editFixed}
        onSuccess={handleFixedSuccess}
      />
      <VariableCostModal
        isOpen={variableModalOpen}
        onClose={() => { setVariableModalOpen(false); setEditVariable(null); }}
        vehicleId={vehicleId}
        editRow={editVariable}
        trips={trips}
        onSuccess={handleVariableSuccess}
      />
      <ConfirmDialog
        isOpen={deleteFixedOpen || deleteVariableOpen}
        title="ยืนยันการลบ"
        message={
          costToDelete ? (
            <>
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
              <br />
              <span className="font-semibold text-slate-900 dark:text-white">{costToDelete.label}</span>
            </>
          ) : 'ยืนยันการลบ'
        }
        confirmText="ลบ"
        cancelText="ยกเลิก"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
};
