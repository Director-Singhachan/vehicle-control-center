import React from 'react';
import { Download, FileText, Filter, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { excelExport } from '../../utils/excelExport';
import { useVehicleDocumentReports } from '../../hooks/useVehicleDocumentReports';
import type { DocumentReportRow } from '../../services/vehicleDocumentReportService';
import { VehicleGroupBadge } from './VehicleGroupBadge';
import { pdfService } from '../../services/pdfService';
import type { Database } from '../../types/database';

type OwnerGroup = Database['public']['Tables']['vehicles']['Row']['owner_group'];

type OwnerGroupKey = Exclude<OwnerGroup, null> | 'unknown';

type DocumentType = Database['public']['Tables']['vehicle_documents']['Row']['document_type'];

type DocumentStatus = Database['public']['Tables']['vehicle_documents']['Row']['status'];

type PeriodMonths = 1 | 3 | 6;

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  registration: 'ทะเบียนรถ / เล่มรถ',
  tax: 'ภาษีรถ / ต่อทะเบียน',
  insurance: 'ประกัน',
  inspection: 'พรบ./ตรวจสภาพ',
  other: 'อื่นๆ',
};

const OWNER_GROUP_LABELS: Record<Exclude<OwnerGroup, null>, string> = {
  thaikit: 'บริษัทไทยกิจ',
  sing_chanthaburi: 'บริษัทสิงห์จันทบุรีจำกัด',
  rental: 'รถเช่า',
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  active: 'ใช้งาน',
  expired: 'หมดอายุ',
  pending: 'รออนุมัติ',
  cancelled: 'ยกเลิก',
};

const toISODate = (d: Date) => d.toISOString().split('T')[0];

const getDaysUntil = (expiryDate: string | null) => {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const groupBy = <T, K extends string | number>(arr: T[], getKey: (t: T) => K) => {
  const map = new Map<K, T[]>();
  arr.forEach((item) => {
    const k = getKey(item);
    map.set(k, [...(map.get(k) || []), item]);
  });
  return map;
};

export const VehicleDocumentReports: React.FC<{ isDark?: boolean }> = () => {
  const [periodMonths, setPeriodMonths] = React.useState<PeriodMonths>(1);
  const [documentType, setDocumentType] = React.useState<DocumentType | 'all'>('all');
  const [ownerGroup, setOwnerGroup] = React.useState<OwnerGroup | 'all'>('all');
  const [status, setStatus] = React.useState<DocumentStatus | 'all'>('all');
  const [includeExpired, setIncludeExpired] = React.useState(true);

  const { data, loading, error, refetch } = useVehicleDocumentReports({
    periodMonths,
    documentType,
    ownerGroup,
    status,
    includeExpired,
  });

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const endDate = React.useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + periodMonths);
    return d;
  }, [today, periodMonths]);

  const summary = React.useMemo(() => {
    const rows: DocumentReportRow[] = data;

    const countsByType = groupBy<DocumentReportRow, DocumentType>(rows, (r) => r.document_type);
    const countsByGroup = groupBy<DocumentReportRow, OwnerGroupKey>(
      rows,
      (r) => ((r.vehicle?.owner_group ?? 'unknown') as OwnerGroupKey)
    );

    let critical = 0;
    let warning = 0;
    let ok = 0;

    rows.forEach((r) => {
      const days = getDaysUntil(r.expiry_date);
      if (days === null) return;
      if (days < 0 || r.status === 'expired') {
        critical++;
      } else if (days <= 7) {
        critical++;
      } else if (days <= 30) {
        warning++;
      } else {
        ok++;
      }
    });

    return {
      total: rows.length,
      critical,
      warning,
      ok,
      countsByType: Array.from(countsByType.entries()).map(([k, v]) => ({ type: k, count: v.length })),
      countsByGroup: Array.from(countsByGroup.entries()).map(([k, v]) => ({
        owner_group: k,
        count: v.length,
      })),
    };
  }, [data]);

  const exportExcelList = () => {
    if (!data || data.length === 0) return;

    const rows = data.map((r) => {
      const days = getDaysUntil(r.expiry_date);
      return {
        plate: r.vehicle?.plate || '-',
        owner_group: r.vehicle?.owner_group || '-',
        document_type: r.document_type,
        status: r.status,
        issued_date: r.issued_date,
        expiry_date: r.expiry_date,
        days_until: days === null ? '-' : String(days),
        file_name: r.file_name,
        file_url: r.file_url,
        branch: r.vehicle?.branch || '-',
      };
    });

    excelExport.exportToExcel(
      rows,
      [
        { key: 'plate', label: 'ทะเบียน', width: 14 },
        { key: 'owner_group', label: 'กลุ่มรถ', width: 18 },
        { key: 'branch', label: 'สาขา', width: 14 },
        { key: 'document_type', label: 'ประเภทเอกสาร', width: 18 },
        { key: 'status', label: 'สถานะ', width: 12 },
        { key: 'issued_date', label: 'วันที่ออก', width: 14, format: excelExport.formatDate },
        { key: 'expiry_date', label: 'วันหมดอายุ', width: 14, format: excelExport.formatDate },
        { key: 'days_until', label: 'เหลือ(วัน)', width: 10 },
        { key: 'file_name', label: 'ชื่อไฟล์', width: 30 },
        { key: 'file_url', label: 'ลิงก์ไฟล์', width: 40 },
      ],
      `รายงานเอกสารรถ_${toISODate(new Date())}.xlsx`,
      'รายงานเอกสารรถ'
    );
  };

  const exportExcelSummaryByGroup = () => {
    if (!data || data.length === 0) return;

    const grouped = groupBy<DocumentReportRow, OwnerGroupKey>(
      data,
      (r) => ((r.vehicle?.owner_group ?? 'unknown') as OwnerGroupKey)
    );
    const rows = Array.from(grouped.entries()).map(([group, items]) => {
      const critical = items.filter((r) => {
        const days = getDaysUntil(r.expiry_date);
        if (days === null) return false;
        return days < 0 || r.status === 'expired' || days <= 7;
      }).length;
      const warning = items.filter((r) => {
        const days = getDaysUntil(r.expiry_date);
        if (days === null) return false;
        return days > 7 && days <= 30 && r.status !== 'expired';
      }).length;

      return {
        owner_group: group,
        total: items.length,
        critical,
        warning,
      };
    });

    excelExport.exportToExcel(
      rows,
      [
        { key: 'owner_group', label: 'กลุ่มรถ', width: 20 },
        { key: 'total', label: 'จำนวนเอกสาร', width: 14, format: excelExport.formatNumber },
        { key: 'critical', label: 'เร่งด่วน', width: 12, format: excelExport.formatNumber },
        { key: 'warning', label: 'เตือนล่วงหน้า', width: 14, format: excelExport.formatNumber },
      ],
      `รายงานเอกสารรถ_สรุปตามกลุ่มรถ_${toISODate(new Date())}.xlsx`,
      'สรุปตามกลุ่มรถ'
    );
  };

  const exportPdfList = async () => {
    if (!data || data.length === 0) return;
    await pdfService.generateVehicleDocumentsReportPDF({
      rows: data,
      periodMonths,
      includeExpired,
      generatedAt: new Date().toISOString(),
    });
  };

  const exportPdfSummaryByGroup = async () => {
    if (!data || data.length === 0) return;
    await pdfService.generateVehicleDocumentsSummaryByOwnerGroupPDF({
      rows: data,
      periodMonths,
      includeExpired,
      generatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h4 className="font-medium text-slate-900 dark:text-slate-100">ตัวกรอง</h4>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ช่วงเวลา</label>
            <select
              value={periodMonths}
              onChange={(e) => setPeriodMonths(Number(e.target.value) as PeriodMonths)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value={1}>1 เดือน</option>
              <option value={3}>3 เดือน</option>
              <option value={6}>6 เดือน</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ประเภทเอกสาร</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">ทั้งหมด</option>
              <option value="registration">{DOCUMENT_TYPE_LABELS.registration}</option>
              <option value="tax">{DOCUMENT_TYPE_LABELS.tax}</option>
              <option value="insurance">{DOCUMENT_TYPE_LABELS.insurance}</option>
              <option value="inspection">{DOCUMENT_TYPE_LABELS.inspection}</option>
              <option value="other">{DOCUMENT_TYPE_LABELS.other}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">กลุ่มรถ</label>
            <select
              value={ownerGroup === null ? '' : (ownerGroup as any)}
              onChange={(e) => setOwnerGroup((e.target.value || 'all') as any)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">ทั้งหมด</option>
              <option value="thaikit">{OWNER_GROUP_LABELS.thaikit}</option>
              <option value="sing_chanthaburi">{OWNER_GROUP_LABELS.sing_chanthaburi}</option>
              <option value="rental">{OWNER_GROUP_LABELS.rental}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">สถานะ</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">ทั้งหมด</option>
              <option value="active">{STATUS_LABELS.active}</option>
              <option value="expired">{STATUS_LABELS.expired}</option>
              <option value="pending">{STATUS_LABELS.pending}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">รวมเอกสารหมดอายุ</label>
            <div className="flex items-center gap-2 h-[42px]">
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">แสดง</span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          ช่วงวันที่: {today.toLocaleDateString('th-TH')} - {endDate.toLocaleDateString('th-TH')}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <FileText className="w-4 h-4" />
            <span className="text-sm">เอกสารทั้งหมด</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{summary.total}</div>
        </Card>
        <Card className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="text-sm text-red-700 dark:text-red-300">เร่งด่วน</div>
          <div className="text-2xl font-bold text-red-800 dark:text-red-200 mt-2">{summary.critical}</div>
          <div className="text-xs text-red-700 dark:text-red-300">≤ 7 วัน หรือหมดอายุ</div>
        </Card>
        <Card className="p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <div className="text-sm text-amber-700 dark:text-amber-300">เตือนล่วงหน้า</div>
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-2">{summary.warning}</div>
          <div className="text-xs text-amber-700 dark:text-amber-300">8-30 วัน</div>
        </Card>
        <Card className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <div className="text-sm text-green-700 dark:text-green-300">ยังไม่ใกล้หมดอายุ</div>
          <div className="text-2xl font-bold text-green-800 dark:text-green-200 mt-2">{summary.ok}</div>
          <div className="text-xs text-green-700 dark:text-green-300">มากกว่า 30 วัน</div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">รายงานเอกสารรถ</h3>
          <div className="flex gap-2">
            <Button onClick={exportExcelList} variant="outline" size="sm" disabled={!data.length}>
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={exportExcelSummaryByGroup} variant="outline" size="sm" disabled={!data.length}>
              <Download className="w-4 h-4 mr-2" />
              Excel (สรุปกลุ่มรถ)
            </Button>
            <Button onClick={exportPdfList} variant="outline" size="sm" disabled={!data.length}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={exportPdfSummaryByGroup} variant="outline" size="sm" disabled={!data.length}>
              <Download className="w-4 h-4 mr-2" />
              PDF (สรุปกลุ่มรถ)
            </Button>
          </div>
        </div>

        {loading && data.length === 0 ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 dark:text-red-400">{error.message}</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">กลุ่มรถ</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">ประเภทเอกสาร</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">วันหมดอายุ</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">เหลือ(วัน)</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">สถานะ</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">ไฟล์</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const days = getDaysUntil(row.expiry_date);
                  const isCritical = days !== null && (days < 0 || row.status === 'expired' || days <= 7);
                  const isWarning = days !== null && !isCritical && days <= 30;

                  const bg = isCritical
                    ? 'bg-red-50 dark:bg-red-900/10'
                    : isWarning
                      ? 'bg-amber-50 dark:bg-amber-900/10'
                      : '';

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${bg}`}
                    >
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                        {row.vehicle?.plate || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {row.vehicle?.owner_group ? (
                          <VehicleGroupBadge ownerGroup={row.vehicle.owner_group} />
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {DOCUMENT_TYPE_LABELS[row.document_type] || row.document_type}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                        {days === null ? '-' : days}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {STATUS_LABELS[row.status] || row.status}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        <button
                          type="button"
                          className="text-enterprise-600 dark:text-enterprise-400 hover:underline"
                          onClick={() => window.open(row.file_url, '_blank')}
                        >
                          {row.file_name}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
