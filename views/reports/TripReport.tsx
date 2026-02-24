import React from 'react';
import { Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import {
  useMonthlyTripReport,
  useVehicleTripSummary,
  useDriverTripReport,
} from '../../hooks/useReports';

const formatNumber = (value: number, decimals: number = 1) => value.toFixed(decimals);

export interface TripReportProps {
  months: number;
  isDark?: boolean;
}

export const TripReport: React.FC<TripReportProps> = ({ months, isDark = false }) => {
  const { data: monthlyTripReport, loading: tripLoading } = useMonthlyTripReport(months);
  const { data: vehicleTripSummary, loading: tripSummaryLoading } = useVehicleTripSummary(months);
  const { data: driverTripReport, loading: driverTripLoading } = useDriverTripReport(months);

  const exportTripReport = () => {
    if (!monthlyTripReport || monthlyTripReport.length === 0) return;
    excelExport.exportToExcel(
      monthlyTripReport,
      [
        { key: 'monthLabel', label: 'เดือน', width: 15 },
        { key: 'totalTrips', label: 'จำนวนเที่ยว', width: 15, format: excelExport.formatNumber },
        { key: 'totalDistance', label: 'ระยะทางรวม (km)', width: 18, format: excelExport.formatNumber },
        { key: 'totalHours', label: 'เวลารวม (ชม.)', width: 15, format: excelExport.formatNumber },
        { key: 'averageDistance', label: 'ระยะทางเฉลี่ย (km)', width: 20, format: excelExport.formatNumber },
        { key: 'averageHours', label: 'เวลาเฉลี่ย (ชม.)', width: 18, format: excelExport.formatNumber },
      ],
      `รายงานการเดินทาง_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการเดินทาง'
    );
  };

  return (
    <div className="space-y-6">
      {/* Monthly Trip Report */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            รายงานการเดินทางรายเดือน
          </h3>
          <Button onClick={exportTripReport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
        {tripLoading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : monthlyTripReport && monthlyTripReport.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    เดือน
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนเที่ยว
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางรวม (km)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    เวลารวม (ชม.)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางเฉลี่ย (km)
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyTripReport.map((report) => (
                  <tr
                    key={report.month}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {report.monthLabel}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {report.totalTrips}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(report.totalDistance, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(report.totalHours, 1)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(report.averageDistance, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
        )}
      </Card>

      {/* Vehicle Trip Summary */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          สรุปการใช้รถแต่ละคัน
        </h3>
        {tripSummaryLoading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : vehicleTripSummary && vehicleTripSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ทะเบียน
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ยี่ห้อ/รุ่น
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนเที่ยว
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางรวม (km)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางเฉลี่ย (km)
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicleTripSummary.map((vehicle) => (
                  <tr
                    key={vehicle.vehicle_id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {vehicle.plate}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {vehicle.make} {vehicle.model}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {vehicle.totalTrips}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(vehicle.totalDistance, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(vehicle.averageDistance, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
        )}
      </Card>

      {/* Driver Trip Report */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          รายงานพนักงานขับรถ
        </h3>
        {driverTripLoading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : driverTripReport && driverTripReport.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ชื่อพนักงาน
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนเที่ยว
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางรวม (km)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    เวลารวม (ชม.)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    รถที่ใช้
                  </th>
                </tr>
              </thead>
              <tbody>
                {driverTripReport.map((driver) => (
                  <tr
                    key={driver.driver_id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {driver.driver_name}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {driver.totalTrips}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(driver.totalDistance, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(driver.totalHours, 1)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {driver.vehicles_used.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
        )}
      </Card>
    </div>
  );
};
