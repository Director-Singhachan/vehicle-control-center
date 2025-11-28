// Settings View - Notification settings for LINE and Telegram
import React, { useEffect, useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Bell, MessageCircle, Send } from 'lucide-react';
import { notificationService, type NotificationSettings } from '../services/notificationService';
import { useAuth } from '../hooks';

export const SettingsView: React.FC = () => {
  const { profile, isAdmin, isManager, isInspector, isExecutive, isDriver, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasPermission =
    isAdmin ||
    isManager ||
    isInspector ||
    isExecutive ||
    (profile?.role && ['admin', 'manager', 'inspector', 'executive'].includes(profile.role));

  useEffect(() => {
    // ถ้าเป็นพนักงานขับรถ (driver) หรือไม่มีสิทธิ์ ไม่ต้องโหลด settings เลย
    if (isDriver && !hasPermission) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await notificationService.getMySettings();
        setSettings(result);
      } catch (err: any) {
        console.error('[SettingsView] Error loading notification settings:', err);
        setError(err.message || 'ไม่สามารถโหลดการตั้งค่าการแจ้งเตือนได้');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isDriver, hasPermission]);

  const handleToggle = (key: keyof NotificationSettings) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key] as any,
    });
  };

  const handleChange = (key: keyof NotificationSettings, value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { id, user_id, ...updatePayload } = settings;
      const updated = await notificationService.updateMySettings(updatePayload);
      setSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('[SettingsView] Error saving notification settings:', err);
      setError(err.message || 'ไม่สามารถบันทึกการตั้งค่าการแจ้งเตือนได้');
    } finally {
      setSaving(false);
    }
  };

  // ถ้าไม่มีสิทธิ์ดูหน้า Settings (เช่น พนักงานขับรถ)
  if (!authLoading && (isDriver && !hasPermission)) {
    return (
      <PageLayout
        title="ตั้งค่า"
        subtitle="การตั้งค่าการแจ้งเตือน"
        loading={false}
        error={false}
      >
        <div className="max-w-xl mx-auto mt-8 border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50/80 dark:bg-slate-900/60">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
            ไม่สามารถตั้งค่าด้วยตัวเองได้
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            การตั้งค่าการแจ้งเตือนถูกจำกัดให้{' '}
            <span className="font-medium">ผู้ดูแลระบบ / ผู้จัดการ / ผู้ตรวจสอบ / ผู้บริหาร</span>{' '}
            เป็นผู้กำหนดเท่านั้น หากต้องการเปลี่ยนแปลงการแจ้งเตือน กรุณาติดต่อผู้ดูแลระบบของคุณ
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="ตั้งค่า"
      subtitle="จัดการการแจ้งเตือนผ่าน LINE และ Telegram"
      loading={loading}
      error={!!error && !settings}
      onRetry={() => {
        setError(null);
        setSuccess(false);
        setLoading(true);
        notificationService
          .getMySettings()
          .then((result) => setSettings(result))
          .catch((err: any) => setError(err.message || 'ไม่สามารถโหลดการตั้งค่าการแจ้งเตือนได้'))
          .finally(() => setLoading(false));
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Settings */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-5 h-5 text-enterprise-600" />
                ช่องทางการแจ้งเตือน
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                เลือกเปิด/ปิดการแจ้งเตือน และกำหนด token สำหรับ LINE / Telegram
              </p>
            </div>
          </div>

          {settings && (
            <div className="space-y-6">
              {/* LINE Settings */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/80 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">LINE Notify</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        แจ้งเตือนเข้าห้องแชท LINE ที่คุณกำหนด
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enable_line')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.enable_line ? 'bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settings.enable_line ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <Input
                    label="LINE Notify Token"
                    type="password"
                    placeholder="ใส่ LINE Notify token"
                    value={settings.line_token || ''}
                    onChange={(e) => handleChange('line_token', e.target.value)}
                    helperText="สร้าง token ได้จากหน้า LINE Notify แล้วนำมาวางที่นี่"
                    disabled={!settings.enable_line}
                  />
                </div>
              </div>

              {/* Telegram Settings */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/80 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-sky-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Telegram Bot</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ใช้ Telegram Bot ส่งข้อความเข้า chat/group
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enable_telegram')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.enable_telegram ? 'bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settings.enable_telegram ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <Input
                    label="Telegram Bot Token (ไม่บังคับ)"
                    type="password"
                    placeholder="เว้นว่างไว้ถ้าใช้ Token เดียวกันกับระบบ"
                    value={settings.telegram_bot_token || ''}
                    onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                    helperText="เว้นว่างไว้ = ใช้ Token จากระบบ (แนะนำ) | ใส่ Token = ใช้ Token ของตัวเอง (ถ้าต้องการใช้ Bot ต่างกัน)"
                    disabled={!settings.enable_telegram}
                  />
                  <Input
                    label="Telegram Chat ID (จำเป็น)"
                    placeholder="เช่น 123456789 หรือ -1001234567890 (group)"
                    value={settings.telegram_chat_id || ''}
                    onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                    helperText="จำเป็นต้องใส่ - ใช้ @userinfobot หรือ @getidsbot เพื่อหา Chat ID ของคุณ"
                    disabled={!settings.enable_telegram}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Event Toggles */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
            ประเภทการแจ้งเตือน
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            เลือกเหตุการณ์ที่ต้องการให้ระบบส่งแจ้งเตือนอัตโนมัติ
          </p>

          {settings && (
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_maintenance_due}
                  onChange={() => handleToggle('notify_maintenance_due')}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อใกล้ถึงกำหนดซ่อมบำรุง
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ระบบจะเตือนเมื่อ maintenance schedule ใกล้ถึงกำหนดตามที่ตั้งไว้
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_long_checkout}
                  onChange={() => handleToggle('notify_long_checkout')}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อรถ Check-out นานเกินกำหนด
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เช่น ออกไปเกิน 12 ชั่วโมงแล้วยังไม่ Check-in กลับ
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_ticket_created}
                  onChange={() => handleToggle('notify_ticket_created')}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อมีตั๋วซ่อมใหม่
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ส่งแจ้งเตือนเมื่อพนักงานแจ้งซ่อมรถคันใหม่เข้าระบบ
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_ticket_closed}
                  onChange={() => handleToggle('notify_ticket_closed')}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อตั๋วซ่อมเสร็จสิ้น
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ใช้แจ้งให้ผู้เกี่ยวข้องทราบว่าการซ่อมเสร็จแล้ว พร้อมใช้งาน
                  </p>
                </div>
              </label>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm">
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
          {success && !error && (
            <p className="text-green-600 dark:text-green-400">บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว</p>
          )}
        </div>
        <Button onClick={handleSave} isLoading={saving} disabled={!settings}>
          บันทึกการตั้งค่า
        </Button>
      </div>
    </PageLayout>
  );
};


