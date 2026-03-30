// Product Pallet Config Manager - จัดการข้อมูลการจัดเรียงสินค้าบนพาเลท
import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface PalletConfig {
  id: string;
  product_id: string;
  pallet_id: string;
  config_name: string;
  description?: string | null;
  layers: number;
  units_per_layer: number;
  total_units: number;
  total_height_cm?: number | null;
  total_weight_kg?: number | null;
  is_default: boolean;
  is_safe_mode: boolean;
  is_compact_mode: boolean;
  requires_strapping: boolean;
  requires_special_handling: boolean;
  notes?: string | null;
  is_active: boolean;
  pallet?: {
    pallet_code: string;
    pallet_name: string;
  };
}

interface Pallet {
  id: string;
  pallet_code: string;
  pallet_name: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

interface ProductPalletConfigManagerProps {
  productId: string;
  productName: string;
  canEdit?: boolean;
  /** ลบแบบจัดเรียง — ใช้ระดับเดียวกับการลบสินค้า (tab.products = manage) */
  canManage?: boolean;
}

export const ProductPalletConfigManager: React.FC<ProductPalletConfigManagerProps> = ({
  productId,
  productName,
  canEdit = true,
  canManage = true,
}) => {
  const [configs, setConfigs] = useState<PalletConfig[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [productDimensions, setProductDimensions] = useState<{ height_cm: number | null; weight_kg: number | null }>({
    height_cm: null,
    weight_kg: null,
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PalletConfig | null>(null);
  const [formData, setFormData] = useState({
    pallet_id: '',
    config_name: '',
    description: '',
    layers: 7,
    units_per_layer: 18,
    total_height_cm: '',
    total_weight_kg: '',
    is_default: false,
    is_safe_mode: true,
    is_compact_mode: false,
    requires_strapping: false,
    requires_special_handling: false,
    notes: '',
  });
  
  // Separate display values for number inputs to allow deletion
  const [layersDisplay, setLayersDisplay] = useState<string>('7');
  const [unitsPerLayerDisplay, setUnitsPerLayerDisplay] = useState<string>('18');

  // Load pallets
  useEffect(() => {
    const loadPallets = async () => {
      const { data, error } = await supabase
        .from('pallets')
        .select('id, pallet_code, pallet_name, length_cm, width_cm, height_cm')
        .eq('is_active', true)
        .order('pallet_code');

      if (error) {
        console.error('Error loading pallets:', error);
      } else {
        setPallets(data || []);
      }
    };

    loadPallets();
  }, []);

  // Load product dimensions (height_cm, weight_kg) for auto-calculation
  useEffect(() => {
    if (!productId) return;

    const loadProduct = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('height_cm, weight_kg')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error loading product dimensions:', error);
        setProductDimensions({ height_cm: null, weight_kg: null });
      } else {
        setProductDimensions({
          height_cm: data?.height_cm != null ? Number(data.height_cm) : null,
          weight_kg: data?.weight_kg != null ? Number(data.weight_kg) : null,
        });
      }
    };

    loadProduct();
  }, [productId]);

  // Load configs
  useEffect(() => {
    if (!productId) return;

    const loadConfigs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('product_pallet_configs')
          .select(`
            *,
            pallet:pallets(pallet_code, pallet_name)
          `)
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('config_name');

        if (error) throw error;

        setConfigs((data || []) as PalletConfig[]);
      } catch (err: any) {
        console.error('Error loading pallet configs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfigs();
  }, [productId]);

  const handleOpenModal = (config?: PalletConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        pallet_id: config.pallet_id,
        config_name: config.config_name,
        description: config.description || '',
        layers: config.layers,
        units_per_layer: config.units_per_layer,
        total_height_cm: config.total_height_cm?.toString() || '',
        total_weight_kg: config.total_weight_kg?.toString() || '',
        is_default: config.is_default,
        is_safe_mode: config.is_safe_mode,
        is_compact_mode: config.is_compact_mode,
        requires_strapping: config.requires_strapping,
        requires_special_handling: config.requires_special_handling,
        notes: config.notes || '',
      });
      // Set display values for editing
      setLayersDisplay(config.layers.toString());
      setUnitsPerLayerDisplay(config.units_per_layer.toString());
    } else {
      setEditingConfig(null);
      setFormData({
        pallet_id: '',
        config_name: '',
        description: '',
        layers: 7,
        units_per_layer: 18,
        total_height_cm: '',
        total_weight_kg: '',
        is_default: false,
        is_safe_mode: true,
        is_compact_mode: false,
        requires_strapping: false,
        requires_special_handling: false,
        notes: '',
      });
      // Reset display values for new config
      setLayersDisplay('7');
      setUnitsPerLayerDisplay('18');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingConfig(null);
    // Reset display values
    setLayersDisplay('7');
    setUnitsPerLayerDisplay('18');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pallet_id || !formData.config_name || !formData.layers || !formData.units_per_layer) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const payload: any = {
        product_id: productId,
        pallet_id: formData.pallet_id,
        config_name: formData.config_name.trim(),
        description: formData.description.trim() || null,
        layers: formData.layers,
        units_per_layer: formData.units_per_layer,
        total_height_cm: formData.total_height_cm ? parseFloat(formData.total_height_cm) : null,
        total_weight_kg: formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : null,
        is_default: formData.is_default,
        is_safe_mode: formData.is_safe_mode,
        is_compact_mode: formData.is_compact_mode,
        requires_strapping: formData.requires_strapping,
        requires_special_handling: formData.requires_special_handling,
        notes: formData.notes.trim() || null,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('product_pallet_configs')
          .update(payload)
          .eq('id', editingConfig.id);

        if (error) throw error;
        alert('บันทึกข้อมูลเรียบร้อย');
      } else {
        const { error } = await supabase
          .from('product_pallet_configs')
          .insert(payload);

        if (error) throw error;
        alert('เพิ่มข้อมูลเรียบร้อย');
      }

      // Reload configs
      const { data, error: reloadError } = await supabase
        .from('product_pallet_configs')
        .select(`
          *,
          pallet:pallets(pallet_code, pallet_name)
        `)
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('config_name');

      if (!reloadError) {
        setConfigs((data || []) as PalletConfig[]);
      }

      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving pallet config:', err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถบันทึกข้อมูลได้'));
    }
  };

  const handleDelete = async (id: string, configName: string) => {
    if (!canManage) return;
    if (!confirm(`ต้องการลบแบบจัดเรียง "${configName}" ใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase
        .from('product_pallet_configs')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Reload configs
      const { data, error: reloadError } = await supabase
        .from('product_pallet_configs')
        .select(`
          *,
          pallet:pallets(pallet_code, pallet_name)
        `)
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('config_name');

      if (!reloadError) {
        setConfigs((data || []) as PalletConfig[]);
      }

      alert('ลบข้อมูลเรียบร้อย');
    } catch (err: any) {
      console.error('Error deleting pallet config:', err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถลบข้อมูลได้'));
    }
  };

  // Calculate total units automatically
  const totalUnits = formData.layers * formData.units_per_layer;

  // Auto-calculate total_height_cm and total_weight_kg when layers, units_per_layer or pallet_id change
  useEffect(() => {
    if (!isModalOpen || (formData.layers <= 0 && formData.units_per_layer <= 0)) return;

    const totalUnitsCalc = formData.layers * formData.units_per_layer;
    const pallet = formData.pallet_id ? pallets.find((p) => p.id === formData.pallet_id) : null;

    let newHeight = '';
    let newWeight = '';

    if (productDimensions.height_cm != null && productDimensions.height_cm > 0 && formData.layers > 0) {
      const palletH = pallet?.height_cm ?? 0;
      newHeight = (palletH + formData.layers * productDimensions.height_cm).toFixed(1);
    }
    if (productDimensions.weight_kg != null && productDimensions.weight_kg >= 0 && totalUnitsCalc > 0) {
      newWeight = (totalUnitsCalc * productDimensions.weight_kg).toFixed(2);
    }

    if (newHeight !== '' || newWeight !== '') {
      setFormData((prev) => ({
        ...prev,
        ...(newHeight !== '' && { total_height_cm: newHeight }),
        ...(newWeight !== '' && { total_weight_kg: newWeight }),
      }));
    }
  }, [
    isModalOpen,
    formData.layers,
    formData.units_per_layer,
    formData.pallet_id,
    productDimensions.height_cm,
    productDimensions.weight_kg,
    pallets,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Package className="w-5 h-5" />
          รูปแบบการจัดเรียงบนพาเลท
        </h3>
        {canEdit && (
          <Button size="sm" onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-1" />
            เพิ่มแบบจัดเรียง
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          กำลังโหลดข้อมูล...
        </div>
      ) : configs.length === 0 ? (
        <Card className="p-6 text-center text-slate-500 dark:text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>ยังไม่มีข้อมูลการจัดเรียงบนพาเลท</p>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => handleOpenModal()}
            >
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มแบบจัดเรียงแรก
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map((config) => (
            <Card key={config.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {config.config_name}
                    </h4>
                    {config.is_default && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                        ค่าเริ่มต้น
                      </span>
                    )}
                    {config.is_safe_mode && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                        ปลอดภัย
                      </span>
                    )}
                    {config.is_compact_mode && (
                      <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded">
                        อัดแน่น
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    พาเลท: {config.pallet?.pallet_name || config.pallet_id}
                  </p>
                </div>
                {(canEdit || canManage) && (
                  <div className="flex gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(config)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDelete(config.id, config.config_name)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">จำนวนชั้น:</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-white">
                      {config.layers} ชั้น
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">ต่อชั้น:</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-white">
                      {config.units_per_layer} {config.pallet?.pallet_code === 'PAL-STD' ? 'ลัง/ถาด' : 'หน่วย'}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-slate-900 dark:text-white">
                      รวม: {config.total_units} {config.pallet?.pallet_code === 'PAL-STD' ? 'ลัง/ถาด' : 'หน่วย'} ต่อพาเลท
                    </span>
                  </div>
                </div>
                {config.total_height_cm && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">ความสูงรวม:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">
                      {config.total_height_cm.toFixed(1)} ซม.
                    </span>
                  </div>
                )}
                {config.total_weight_kg && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">น้ำหนักรวม:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">
                      {config.total_weight_kg.toFixed(2)} กก.
                    </span>
                  </div>
                )}
                {config.requires_strapping && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs">ต้องใช้ฟิล์มพัน/รัด</span>
                  </div>
                )}
                {config.notes && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {config.notes}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingConfig ? 'แก้ไขแบบจัดเรียง' : 'เพิ่มแบบจัดเรียงใหม่'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              พาเลท <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.pallet_id}
              onChange={(e) => setFormData({ ...formData, pallet_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- เลือกพาเลท --</option>
              {pallets.map((pallet) => (
                <option key={pallet.id} value={pallet.id}>
                  {pallet.pallet_code} - {pallet.pallet_name} ({pallet.length_cm}x{pallet.width_cm} ซม.)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              ชื่อแบบจัดเรียง <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.config_name}
              onChange={(e) => setFormData({ ...formData, config_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น มาตรฐาน 126 ถาด, อัดเต็ม 140 ถาด"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              คำอธิบาย
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="เช่น จัดเรียงแบบมาตรฐาน ปลอดภัย"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                จำนวนชั้น <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={layersDisplay}
                onChange={(e) => {
                  const value = e.target.value;
                  setLayersDisplay(value);
                  if (value === '') {
                    setFormData({ ...formData, layers: 0 });
                  } else {
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setFormData({ ...formData, layers: numValue });
                    }
                  }
                }}
                onBlur={(e) => {
                  // Ensure valid value on blur
                  const value = e.target.value;
                  if (value === '' || parseInt(value, 10) < 1) {
                    setLayersDisplay('1');
                    setFormData({ ...formData, layers: 1 });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                จำนวนต่อชั้น (ลัง/ถาด) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={unitsPerLayerDisplay}
                onChange={(e) => {
                  const value = e.target.value;
                  setUnitsPerLayerDisplay(value);
                  if (value === '') {
                    setFormData({ ...formData, units_per_layer: 0 });
                  } else {
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setFormData({ ...formData, units_per_layer: numValue });
                    }
                  }
                }}
                onBlur={(e) => {
                  // Ensure valid value on blur
                  const value = e.target.value;
                  if (value === '' || parseInt(value, 10) < 1) {
                    setUnitsPerLayerDisplay('1');
                    setFormData({ ...formData, units_per_layer: 1 });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Auto-calculated total */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  จำนวนรวม: {totalUnits} ลัง/ถาด ต่อพาเลท
                </span>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  (คำนวณอัตโนมัติ: {formData.layers} ชั้น × {formData.units_per_layer} ต่อชั้น)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ความสูงรวม (ซม.)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.total_height_cm}
                onChange={(e) => setFormData({ ...formData, total_height_cm: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น 180.5"
              />
              {productDimensions.height_cm != null && productDimensions.height_cm > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  คำนวณอัตโนมัติ: ความสูงพาเลท + (จำนวนชั้น × ความสูงต่อหน่วย)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                น้ำหนักรวม (กก.)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.total_weight_kg}
                onChange={(e) => setFormData({ ...formData, total_weight_kg: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น 850.50"
              />
              {productDimensions.weight_kg != null && productDimensions.weight_kg >= 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  คำนวณอัตโนมัติ: จำนวนสินค้าทั้งหมด × น้ำหนักต่อหน่วย
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                ใช้เป็นค่าเริ่มต้น (ถ้ามีหลายแบบ)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_safe_mode}
                onChange={(e) => setFormData({ ...formData, is_safe_mode: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                โหมดปลอดภัย (ไม่เสี่ยงล้ม/ยุบ)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_compact_mode}
                onChange={(e) => setFormData({ ...formData, is_compact_mode: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                โหมดอัดแน่น (ประหยัดพื้นที่)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requires_strapping}
                onChange={(e) => setFormData({ ...formData, requires_strapping: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                ต้องใช้ฟิล์มพัน/รัด
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requires_special_handling}
                onChange={(e) => setFormData({ ...formData, requires_special_handling: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                ต้องจัดการพิเศษ
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              หมายเหตุ
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="เช่น ใช้เฉพาะลูกค้า X, ต้องใช้ฟิล์มพันเพิ่ม"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" onClick={handleCloseModal} variant="outline">
              ยกเลิก
            </Button>
            <Button type="submit">
              {editingConfig ? 'บันทึก' : 'เพิ่มแบบจัดเรียง'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
