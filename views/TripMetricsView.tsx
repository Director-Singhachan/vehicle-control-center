// Trip Metrics View - บันทึกข้อมูลหลังจบทริป (AI Trip Optimization - Data Collection)
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Package,
  Gauge,
  Clock,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliveryTrip } from '../hooks';
import {
  tripMetricsService,
  type TripMetrics,
} from '../services/tripMetricsService';
import { Info } from 'lucide-react';

interface TripMetricsViewProps {
  tripId: string;
  onSaved?: () => void;
  onBack?: () => void;
}

const emptyForm: TripMetrics = {
  actual_pallets_used: undefined,
  actual_weight_kg: undefined,
  space_utilization_percent: undefined,
  packing_efficiency_score: undefined,
  had_packing_issues: false,
  packing_issues_notes: undefined,
  actual_distance_km: undefined,
  actual_duration_hours: undefined,
};

export const TripMetricsView: React.FC<TripMetricsViewProps> = ({
  tripId,
  onSaved,
  onBack,
}) => {
  const { trip, loading: loadingTrip, error: tripError, refetch } = useDeliveryTrip(tripId);
  const [form, setForm] = useState<TripMetrics>(emptyForm);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [basicData, setBasicData] = useState<{
    total_products_quantity: number;
    total_items_count: number;
    stores_count: number;
    distance_km: number | null;
    duration_hours: number | null;
    calculated_weight_kg: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingMetrics(true);
      try {
        // โหลดข้อมูลพื้นฐานที่มีอยู่แล้ว
        const basic = await tripMetricsService.getTripBasicData(tripId);
        if (!cancelled) {
          setBasicData(basic);
        }

        // โหลดข้อมูล metrics ที่บันทึกไว้แล้ว
        const metrics = await tripMetricsService.getTripMetrics(tripId);
        if (!cancelled && metrics) {
          setForm({
            actual_pallets_used: metrics.actual_pallets_used ?? undefined,
            actual_weight_kg: metrics.actual_weight_kg ?? undefined,
            space_utilization_percent: metrics.space_utilization_percent ?? undefined,
            packing_efficiency_score: metrics.packing_efficiency_score ?? undefined,
            had_packing_issues: metrics.had_packing_issues ?? false,
            packing_issues_notes: metrics.packing_issues_notes ?? undefined,
            actual_distance_km: metrics.actual_distance_km ?? undefined,
            actual_duration_hours: metrics.actual_duration_hours ?? undefined,
          });
        } else if (!cancelled) {
          // ยังไม่เคยบันทึก metrics → เติมน้ำหนักจากที่ระบบคำนวณไว้ให้อัตโนมัติ
          const weightFromSystem = basic?.calculated_weight_kg;
          setForm({
            ...emptyForm,
            actual_weight_kg: weightFromSystem && weightFromSystem > 0 ? weightFromSystem : undefined,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[TripMetricsView] Error loading metrics:', err);
          setForm(emptyForm);
        }
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const update = (field: keyof TripMetrics, value: number | string | boolean | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await tripMetricsService.saveTripMetrics(tripId, form);
      setSaveSuccess(true);
      setTimeout(() => {
        onSaved?.();
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถบันทึกได้';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingTrip || !trip) {
    return (
      <PageLayout
        title="บันทึกเมตริกซ์ทริป"
        subtitle="ข้อมูลหลังจบทริป"
        loading={true}
      />
    );
  }

  if (tripError) {
    return (
      <PageLayout
        title="บันทึกเมตริกซ์ทริป"
        subtitle="ข้อมูลหลังจบทริป"
        error={true}
        onRetry={refetch}
      >
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-red-600 dark:text-red-400">
            {tripError?.message || 'ไม่พบข้อมูลทริป'}
          </p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`บันทึกเมตริกซ์ - ${trip.trip_number || 'ทริป'}`}
      subtitle="กรอกข้อมูลหลังจบทริป (สำหรับวิเคราะห์และ AI)"
      actions={
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft size={18} className="mr-2" />
              กลับ
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
            disabled={saving}
          >
            <Save size={18} className="mr-2" />
            บันทึก
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Trip info */}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
            <FileText size={16} />
            <span>
              ทริป {trip.trip_number} · วันที่ {trip.planned_date}
              {trip.vehicle?.plate && ` · รถ ${trip.vehicle.plate}`}
            </span>
          </div>
        </Card>

        {saveError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={18} />
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
            <CheckCircle size={18} />
            บันทึกเมตริกซ์เรียบร้อย
          </div>
        )}

        {/* แสดงข้อมูลที่มีอยู่แล้ว */}
        {basicData && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  สรุปข้อมูลทริป
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {basicData.total_products_quantity.toLocaleString()}
                    </span>
                    <div className="text-blue-600 dark:text-blue-400 text-xs">จำนวนสินค้า</div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {basicData.total_items_count}
                    </span>
                    <div className="text-blue-600 dark:text-blue-400 text-xs">รายการสินค้า</div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {basicData.stores_count}
                    </span>
                    <div className="text-blue-600 dark:text-blue-400 text-xs">จำนวนร้าน</div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {basicData.calculated_weight_kg > 0
                        ? `${basicData.calculated_weight_kg.toFixed(1)} กก.`
                        : '-'}
                    </span>
                    <div className="text-blue-600 dark:text-blue-400 text-xs">น้ำหนัก (คำนวณจากระบบ)</div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {basicData.distance_km !== null
                        ? `${basicData.distance_km.toLocaleString()} กม.`
                        : '-'}
                    </span>
                    <div className="text-blue-600 dark:text-blue-400 text-xs">ระยะทาง</div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {basicData.duration_hours !== null
                        ? `${basicData.duration_hours.toFixed(1)} ชม.`
                        : '-'}
                    </span>
                    <div className="text-blue-600 dark:text-blue-400 text-xs">ระยะเวลา</div>
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  💡 ข้อมูลเหล่านี้ดึงมาจากทริปอัตโนมัติ และจะถูกใช้ในการเทรน AI
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Package size={20} />
              ข้อมูลที่ต้องบันทึกเพิ่ม (สำหรับ AI)
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ⚠️ ข้อมูลเหล่านี้ไม่มีในระบบ ต้องบันทึกหลังจบทริป
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="จำนวนพาเลทที่ใช้จริง *"
              type="number"
              min={0}
              step={1}
              value={form.actual_pallets_used ?? ''}
              onChange={(e) =>
                update(
                  'actual_pallets_used',
                  e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                )
              }
              placeholder="เช่น 12"
              required
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              ⚠️ สำคัญมาก - ข้อมูลนี้ไม่มีในระบบ
            </div>
            <div>
              <Input
                label="น้ำหนักจริง (กก.)"
                type="number"
                min={0}
                step={0.01}
                value={form.actual_weight_kg ?? ''}
                onChange={(e) =>
                  update(
                    'actual_weight_kg',
                    e.target.value === '' ? undefined : parseFloat(e.target.value)
                  )
                }
                placeholder={
                  basicData?.calculated_weight_kg
                    ? `เช่น ${basicData.calculated_weight_kg.toFixed(1)} (จากระบบ)`
                    : 'เช่น 850.5'
                }
              />
              {basicData?.calculated_weight_kg != null && basicData.calculated_weight_kg > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ค่าที่ระบบคำนวณจากสินค้าในทริป: {basicData.calculated_weight_kg.toFixed(1)} กก.
                </div>
              )}
            </div>
            <Input
              label="% การใช้พื้นที่ (0–100)"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.space_utilization_percent ?? ''}
              onChange={(e) =>
                update(
                  'space_utilization_percent',
                  e.target.value === '' ? undefined : parseFloat(e.target.value)
                )
              }
              placeholder="เช่น 75"
            />
            <Input
              label="คะแนนประสิทธิภาพการจัดเรียง (0–100)"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.packing_efficiency_score ?? ''}
              onChange={(e) =>
                update(
                  'packing_efficiency_score',
                  e.target.value === '' ? undefined : parseFloat(e.target.value)
                )
              }
              placeholder="เช่น 80"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="had_packing_issues"
              checked={form.had_packing_issues ?? false}
              onChange={(e) => update('had_packing_issues', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-enterprise-600 focus:ring-enterprise-500"
            />
            <label
              htmlFor="had_packing_issues"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              มีปัญหาการจัดเรียง / สินค้าไม่พอดี
            </label>
          </div>
          {(form.had_packing_issues ?? false) && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รายละเอียดปัญหา
              </label>
              <textarea
                value={form.packing_issues_notes ?? ''}
                onChange={(e) => update('packing_issues_notes', e.target.value || undefined)}
                placeholder="อธิบายปัญหาที่เกิดขึ้น (เช่น สินค้าเกิน พาเลทไม่พอ)"
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-enterprise-500 focus:border-enterprise-500"
              />
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <MapPin size={20} />
              ระยะทางและเวลา (ถ้าต้องการบันทึกซ้ำ)
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              💡 ข้อมูลนี้มีในระบบแล้ว (จาก trip_logs) แต่สามารถบันทึกซ้ำได้ถ้าต้องการแก้ไข
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="ระยะทางจริง (กม.)"
                type="number"
                min={0}
                step={0.1}
                value={form.actual_distance_km ?? ''}
                onChange={(e) =>
                  update(
                    'actual_distance_km',
                    e.target.value === '' ? undefined : parseFloat(e.target.value)
                  )
                }
                placeholder={basicData?.distance_km ? `${basicData.distance_km.toFixed(1)} (จากระบบ)` : 'เช่น 120.5'}
              />
              {basicData?.distance_km && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ค่าจากระบบ: {basicData.distance_km.toFixed(1)} กม.
                </div>
              )}
            </div>
            <div>
              <Input
                label="เวลาที่ใช้จริง (ชม.)"
                type="number"
                min={0}
                step={0.1}
                value={form.actual_duration_hours ?? ''}
                onChange={(e) =>
                  update(
                    'actual_duration_hours',
                    e.target.value === '' ? undefined : parseFloat(e.target.value)
                  )
                }
                placeholder={basicData?.duration_hours ? `${basicData.duration_hours.toFixed(1)} (จากระบบ)` : 'เช่น 4.5'}
              />
              {basicData?.duration_hours && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ค่าจากระบบ: {basicData.duration_hours.toFixed(1)} ชม.
                </div>
              )}
            </div>
          </div>
        </Card>

        {loadingMetrics && (
          <p className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลที่บันทึกไว้...</p>
        )}
      </div>
    </PageLayout>
  );
};
