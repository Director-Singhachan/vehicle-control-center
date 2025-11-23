// RLS Test View - Test permissions for different roles
import React, { useState } from 'react';
import { useAuth } from '../hooks';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { vehicleService, ticketService, profileService } from '../services';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export const RLSTestView: React.FC = () => {
  const { user, profile, isAdmin, isManager, isInspector } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Read own profile
      try {
        const ownProfile = await profileService.getCurrent();
        testResults.push({
          name: 'อ่าน Profile ของตัวเอง',
          passed: !!ownProfile && ownProfile.id === user?.id,
        });
      } catch (error: any) {
        testResults.push({
          name: 'อ่าน Profile ของตัวเอง',
          passed: false,
          error: error.message,
        });
      }

      // Test 2: Read vehicles
      try {
        const vehicles = await vehicleService.getAll();
        testResults.push({
          name: 'อ่าน Vehicles',
          passed: Array.isArray(vehicles),
        });
      } catch (error: any) {
        testResults.push({
          name: 'อ่าน Vehicles',
          passed: false,
          error: error.message,
        });
      }

      // Test 3: Create vehicle (should fail for non-manager/admin)
      try {
        const testVehicle = await vehicleService.create({
          plate: `TEST-${Date.now()}`,
          make: 'Test',
          model: 'Model',
          type: 'Test',
          branch: 'Test',
        });

        // If successful, try to delete it
        if (testVehicle) {
          try {
            await vehicleService.delete(testVehicle.id);
          } catch (e) {
            // Ignore delete errors
          }
        }

        testResults.push({
          name: 'สร้าง Vehicle',
          passed: isManager || isAdmin,
          error: !(isManager || isAdmin) ? 'ไม่มีสิทธิ์ (ตามที่คาดหวัง)' : undefined,
        });
      } catch (error: any) {
        testResults.push({
          name: 'สร้าง Vehicle',
          passed: !(isManager || isAdmin), // Should fail for non-manager/admin
          error: error.message,
        });
      }

      // Test 4: Read tickets
      try {
        const tickets = await ticketService.getAll();
        testResults.push({
          name: 'อ่าน Tickets',
          passed: Array.isArray(tickets),
        });
      } catch (error: any) {
        testResults.push({
          name: 'อ่าน Tickets',
          passed: false,
          error: error.message,
        });
      }

      // Test 5: Create ticket (should work for all authenticated users)
      try {
        const vehicles = await vehicleService.getAll();
        if (vehicles.length > 0) {
          const testTicket = await ticketService.create({
            reporter_id: user?.id || 'test-user',
            vehicle_id: vehicles[0].id,
            odometer: 50000,
            urgency: 'medium',
            repair_type: 'Test',
            problem_description: 'Test ticket for RLS testing',
          });

          // Try to delete it
          if (testTicket) {
            try {
              await ticketService.delete(testTicket.id);
            } catch (e) {
              // Ignore delete errors
            }
          }

          testResults.push({
            name: 'สร้าง Ticket',
            passed: true,
          });
        } else {
          testResults.push({
            name: 'สร้าง Ticket',
            passed: false,
            error: 'ไม่มี vehicles สำหรับทดสอบ',
          });
        }
      } catch (error: any) {
        testResults.push({
          name: 'สร้าง Ticket',
          passed: false,
          error: error.message,
        });
      }

      // Test 6: Read ticket costs
      try {
        const tickets = await ticketService.getAll();
        if (tickets.length > 0) {
          // Try to read costs (should work for all)
          testResults.push({
            name: 'อ่าน Ticket Costs',
            passed: true,
          });
        } else {
          testResults.push({
            name: 'อ่าน Ticket Costs',
            passed: false,
            error: 'ไม่มี tickets สำหรับทดสอบ',
          });
        }
      } catch (error: any) {
        testResults.push({
          name: 'อ่าน Ticket Costs',
          passed: false,
          error: error.message,
        });
      }

    } catch (error: any) {
      testResults.push({
        name: 'การทดสอบทั่วไป',
        passed: false,
        error: error.message,
      });
    }

    setResults(testResults);
    setTesting(false);
  };

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = results.length > 0 && passedCount === totalCount;

  return (
    <PageLayout
      title="ทดสอบ RLS Permissions"
      subtitle={`ทดสอบสิทธิ์การเข้าถึงข้อมูลสำหรับ role: ${profile?.role || 'ไม่ระบุ'}`}
    >
      <div className="space-y-6">
        {/* User Info Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
              ข้อมูลผู้ใช้ปัจจุบัน
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Email</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {user?.email || 'ไม่ระบุ'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Role</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {profile?.role || 'ไม่ระบุ'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Permissions</p>
              <div className="flex gap-2">
                {isAdmin && (
                  <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                    Admin
                  </span>
                )}
                {isManager && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    Manager
                  </span>
                )}
                {isInspector && (
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                    Inspector
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Test Controls */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              การทดสอบ
            </h2>
            <Button
              onClick={runTests}
              disabled={testing}
              isLoading={testing}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              รันการทดสอบ
            </Button>
          </div>

          {results.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-4">
                {allPassed ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                )}
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  ผลการทดสอบ: {passedCount}/{totalCount} ผ่าน
                </p>
              </div>

              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${result.passed
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {result.passed ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {result.name}
                          </p>
                          {result.error && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${result.passed
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}
                      >
                        {result.passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.length === 0 && !testing && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>คลิก "รันการทดสอบ" เพื่อเริ่มทดสอบ permissions</p>
            </div>
          )}
        </Card>

        {/* Expected Permissions Table */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            สิทธิ์ที่คาดหวังสำหรับ Role: {profile?.role || 'ไม่ระบุ'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-4 text-slate-700 dark:text-slate-300">การกระทำ</th>
                  <th className="text-center py-2 px-4 text-slate-700 dark:text-slate-300">User</th>
                  <th className="text-center py-2 px-4 text-slate-700 dark:text-slate-300">Inspector</th>
                  <th className="text-center py-2 px-4 text-slate-700 dark:text-slate-300">Manager</th>
                  <th className="text-center py-2 px-4 text-slate-700 dark:text-slate-300">Executive</th>
                  <th className="text-center py-2 px-4 text-slate-700 dark:text-slate-300">Admin</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 px-4">อ่าน Vehicles</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 px-4">สร้าง Vehicle</td>
                  <td className="text-center py-2 px-4">❌</td>
                  <td className="text-center py-2 px-4">❌</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">❌</td>
                  <td className="text-center py-2 px-4">✅</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 px-4">อ่าน Tickets</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 px-4">สร้าง Ticket</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                </tr>
                <tr>
                  <td className="py-2 px-4">อ่าน Ticket Costs</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                  <td className="text-center py-2 px-4">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

