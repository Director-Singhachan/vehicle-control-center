// Settings View - Notification settings for LINE and Telegram
import React, { useEffect, useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Bell, MessageCircle, Send } from 'lucide-react';
import { notificationService, type NotificationSettings } from '../services/notificationService';
import { useAuth } from '../hooks';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

export const SettingsView: React.FC = () => {
  const { loading: authLoading, profile, user } = useAuth();
  const { can, loading: featureAccessLoading } = useFeatureAccess();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Lock/unlock state

  const canViewSettings = can('tab.settings', 'view');

  useEffect(() => {
    // ถ้าเป็นพนักงานขับรถ (driver) หรือไม่มีสิทธิ์ ไม่ต้องโหลด settings เลย
    if (featureAccessLoading) {
      return;
    }

    if (!canViewSettings) {
      setLoading(false);
      setSettings(null);
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
  }, [canViewSettings, featureAccessLoading]);

  const handleToggle = (key: keyof NotificationSettings) => {
    if (!settings || !isEditing) return; // Prevent changes when locked
    setSettings({
      ...settings,
      [key]: !settings[key] as any,
    });
  };

  const handleChange = (key: keyof NotificationSettings, value: string) => {
    if (!settings || !isEditing) return; // Prevent changes when locked
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setError(null);
    setSuccess(false);
  };

  const handleCancelEditing = async () => {
    // Reload original settings
    try {
      setLoading(true);
      const result = await notificationService.getMySettings();
      setSettings(result);
      setIsEditing(false);
      setError(null);
      setSuccess(false);
    } catch (err: any) {
      console.error('[SettingsView] Error reloading settings:', err);
      setError(err.message || 'ไม่สามารถโหลดการตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !isEditing) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { id, user_id, ...updatePayload } = settings;
      const updated = await notificationService.updateMySettings(updatePayload);
      setSettings(updated);
      setSuccess(true);
      setIsEditing(false); // Lock after saving
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('[SettingsView] Error saving notification settings:', err);
      setError(err.message || 'ไม่สามารถบันทึกการตั้งค่าการแจ้งเตือนได้');
    } finally {
      setSaving(false);
    }
  };

  const handleUnbindLine = async () => {
    if (!settings) return;
    setUnlinking(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await notificationService.unbindLine();
      setSettings(updated);
      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('[SettingsView] Error unbinding LINE:', err);
      setError(err.message || 'ไม่สามารถยกเลิกการเชื่อมต่อ LINE ได้');
    } finally {
      setUnlinking(false);
    }
  };

  // ถ้าไม่มีสิทธิ์ดูหน้า Settings (เช่น พนักงานขับรถ)
  if ((authLoading || featureAccessLoading) && !settings) {
    return (
      <PageLayout
        title="ตั้งค่า"
        subtitle="การตั้งค่าการแจ้งเตือน"
        loading={true}
        error={false}
      />
    );
  }

  if (!authLoading && !featureAccessLoading && !canViewSettings) {
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
                      <p className="font-medium text-slate-900 dark:text-slate-100">LINE Messaging API</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        แจ้งเตือนผ่าน LINE Bot (LINE OA)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enable_line')}
                    disabled={!isEditing}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.enable_line ? 'bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-600'
                    } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settings.enable_line ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Status Display */}
                  {settings.line_user_id ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">บัญชี LINE ผูกแล้ว</span>
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        LINE User ID: {settings.line_user_id.substring(0, 10)}...
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUnbindLine}
                          disabled={unlinking || saving || loading}
                        >
                          {unlinking ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมต่อ LINE'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="text-sm font-medium">ยังไม่ได้ผูกบัญชี LINE</span>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                        เพื่อรับการแจ้งเตือนผ่าน LINE กรุณาทำตามขั้นตอนต่อไปนี้:
                      </p>
                      <ol className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
                        <li>เพิ่ม LINE Bot เป็นเพื่อน (หากยังไม่ได้เพิ่ม)</li>
                        <li>เปิดแชทกับ LINE Bot แล้วส่งคำสั่ง:</li>
                      </ol>
                      <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-amber-300 dark:border-amber-700">
                        <code className="text-xs font-mono text-amber-900 dark:text-amber-100">
                          bind{' '}
                          {profile?.email || user?.email || 'your.email@company.com'}
                        </code>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        ใช้ email เดียวกับที่ใช้เข้าสู่ระบบ
                      </p>
                    </div>
                  )}

                  {/* Helper text when enabled but not bound */}
                  {settings.enable_line && !settings.line_user_id && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 <strong>หมายเหตุ:</strong> หลังจากผูกบัญชีแล้ว ระบบจะอัปเดตอัตโนมัติ (ไม่ต้องรีเฟรชหน้า)
                      </p>
                    </div>
                  )}

                  {/* Legacy LINE Notify Token (hidden but kept for backward compatibility) */}
                  {settings.line_token && (
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        ⚠️ LINE Notify Token ยังเก็บไว้ (ระบบใช้ LINE Messaging API แล้ว)
                      </p>
                    </div>
                  )}
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
                    disabled={!isEditing}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.enable_telegram ? 'bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-600'
                    } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    disabled={!settings.enable_telegram || !isEditing}
                  />
                  <Input
                    label="Telegram Chat ID (จำเป็น)"
                    placeholder="เช่น 123456789 หรือ -1001234567890 (group)"
                    value={settings.telegram_chat_id || ''}
                    onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                    helperText="จำเป็นต้องใส่ - ใช้ @userinfobot หรือ @getidsbot เพื่อหา Chat ID ของคุณ"
                    disabled={!settings.enable_telegram || !isEditing}
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
                  disabled={!isEditing}
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
                  disabled={!isEditing}
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
                  disabled={!isEditing}
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
                  disabled={!isEditing}
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

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_ticket_approval ?? true}
                  onChange={() => handleToggle('notify_ticket_approval')}
                  disabled={!isEditing}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อมีการอนุมัติ/ปฏิเสธตั๋ว
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ส่งแจ้งเตือนเมื่อมีการอนุมัติหรือปฏิเสธตั๋วซ่อม (สำหรับผู้ตรวจสอบ/ผู้จัดการ)
                  </p>
                </div>
              </label>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                  การแจ้งเตือนการใช้งาน (สามารถปิดได้)
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_fuel_refill ?? true}
                  onChange={() => handleToggle('notify_fuel_refill')}
                  disabled={!isEditing}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อมีการเติมน้ำมัน
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ส่งแจ้งเตือนทุกครั้งที่มีการเติมน้ำมัน (ผู้บริหาร/ผู้จัดการสามารถปิดได้)
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_trip_started ?? true}
                  onChange={() => handleToggle('notify_trip_started')}
                  disabled={!isEditing}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อเริ่มใช้งานรถ
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ส่งแจ้งเตือนเมื่อมีการ Check-out รถ (ผู้บริหาร/ผู้จัดการสามารถปิดได้)
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500"
                  checked={settings.notify_trip_finished ?? true}
                  onChange={() => handleToggle('notify_trip_finished')}
                  disabled={!isEditing}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    แจ้งเตือนเมื่อเสร็จสิ้นการใช้งานรถ
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ส่งแจ้งเตือนเมื่อมีการ Check-in รถ (ผู้บริหาร/ผู้จัดการสามารถปิดได้)
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
          {!isEditing && (
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              การตั้งค่าถูกล็อคอยู่ กดปุ่ม "ตั้งค่า" เพื่อแก้ไข
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <Button
              onClick={handleCancelEditing}
              variant="outline"
              disabled={saving || loading}
            >
              ยกเลิก
            </Button>
          )}
          {!isEditing ? (
            <Button onClick={handleStartEditing} disabled={!settings || loading}>
              ตั้งค่า
            </Button>
          ) : (
            <Button onClick={handleSave} isLoading={saving} disabled={!settings}>
              บันทึกการตั้งค่า
            </Button>
          )}
        </div>
      </div>
    </PageLayout>
  );
};


