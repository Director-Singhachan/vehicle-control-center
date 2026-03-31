// Profile View - User profile management
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks';
import { profileService } from '../services/profileService';
import { User, Shield, LogOut, Save, Edit2, AlertCircle, Camera, Trash2, Upload, Hash, CheckCircle2, KeyRound, Eye, EyeOff, Lock, Check, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Avatar } from '../components/ui/Avatar';

export const ProfileView: React.FC = () => {
  const { user, profile, signOut, refreshProfile, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Login password change (ไม่แก้ไข — ใช้ได้ตามเดิม)
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Avatar upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Password strength helpers ──────────────────────────────────────────
  const pwdRules = {
    minLen: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    notSameAsCurrent: newPassword !== currentPassword || !newPassword,
  };
  const pwdScore = Object.values(pwdRules).filter(Boolean).length;
  const pwdStrength =
    newPassword.length === 0 ? null
    : pwdScore <= 2 ? { label: 'อ่อน', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', bars: 1 }
    : pwdScore === 3 ? { label: 'ปานกลาง', color: 'bg-amber-400', textColor: 'text-amber-600 dark:text-amber-400', bars: 2 }
    : pwdScore === 4 ? { label: 'ดี', color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', bars: 3 }
    : { label: 'แข็งแกร่ง', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', bars: 4 };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword) { setPasswordError('กรุณาระบุรหัสผ่านปัจจุบัน'); return; }
    if (!newPassword) { setPasswordError('กรุณาระบุรหัสผ่านใหม่'); return; }
    if (newPassword.length < 6) { setPasswordError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (newPassword === currentPassword) { setPasswordError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน'); return; }

    setSavingPassword(true);
    setPasswordSuccess(false);
    try {
      await profileService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err: any) {
      setPasswordError(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCancelChangePassword = () => {
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect will be handled by parent component
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ jpg, png หรือ webp');
      return;
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 2MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle avatar upload
  const handleAvatarUpload = async () => {
    if (!selectedFile) return;

    setUploadingAvatar(true);
    setError(null);
    setSuccess(false);

    try {
      await profileService.updateAvatar(selectedFile);
      setSuccess(true);
      setSelectedFile(null);
      setAvatarPreview(null);
      refreshProfile();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle avatar delete
  const handleAvatarDelete = async () => {
    if (!confirm('คุณต้องการลบรูปภาพโปรไฟล์หรือไม่?')) return;

    setUploadingAvatar(true);
    setError(null);
    setSuccess(false);

    try {
      await profileService.removeAvatar();
      setSuccess(true);
      refreshProfile();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการลบรูปภาพ');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Cancel avatar selection
  const handleCancelAvatarSelection = () => {
    setSelectedFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const roleLabels: Record<string, string> = {
    user: 'ผู้ใช้ทั่วไป',
    inspector: 'ผู้ตรวจสอบ',
    manager: 'ผู้จัดการ',
    executive: 'ผู้บริหาร',
    admin: 'ผู้ดูแลระบบ',
    sales: 'ฝ่ายขาย',
    driver: 'พนักงานขับรถ',
    service_staff: 'พนักงานบริการ',
    hr: 'บุคคล',
    warehouse: 'คลังสินค้า',
    dev: 'ผู้พัฒนา',
  };

  return (
    <PageLayout
      title="ข้อมูลส่วนตัว"
      subtitle="จัดการข้อมูลโปรไฟล์ของคุณ"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              ข้อมูลส่วนตัว
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ทุกบทบาทแก้ไขได้เฉพาะรูปโปรไฟล์ — ชื่อ-นามสกุล และรหัสพนักงานกำหนดโดยผู้ดูแลระบบ/HR
            </p>
          </div>

          {/* Avatar Upload Section */}
          <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar Display */}
              <div className="relative">
                <Avatar
                  src={avatarPreview || profile?.avatar_url}
                  alt={profile?.full_name || user?.email || 'User'}
                  size="xl"
                  fallback={profile?.full_name || user?.email}
                />
                {(profile?.avatar_url || avatarPreview) && !uploadingAvatar && (
                  <button
                    onClick={handleAvatarDelete}
                    className="absolute -bottom-1 -right-1 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                    title="ลบรูปภาพ"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    รูปภาพโปรไฟล์
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 2MB
                  </p>
                </div>

                {selectedFile ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      isLoading={uploadingAvatar}
                      size="sm"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      อัพโหลด
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelAvatarSelection}
                      disabled={uploadingAvatar}
                      size="sm"
                    >
                      ยกเลิก
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      <span className="inline-flex items-center px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 bg-transparent rounded-lg font-medium transition-colors duration-200">
                        <Camera className="w-4 h-4 mr-2" />
                        {profile?.avatar_url ? 'เปลี่ยนรูปภาพ' : 'เพิ่มรูปภาพ'}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  บันทึกข้อมูลสำเร็จ
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                อีเมล
              </label>
              <Input
                type="email"
                value={profile?.email || user?.email || ''}
                disabled
                className="bg-slate-50 dark:bg-slate-800"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                อีเมลไม่สามารถแก้ไขได้
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ชื่อ-นามสกุล
              </label>
              <Input
                type="text"
                value={profile?.full_name || ''}
                disabled
                className="bg-slate-50 dark:bg-slate-800"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                แก้ไขได้เฉพาะโดยผู้ดูแลระบบหรือ HR
              </p>
            </div>

            {/* รหัสพนักงาน — แสดงอย่างเดียว ตั้ง/แก้ไขได้เฉพาะ Admin หรือ HR */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รหัสพนักงาน
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                <span className={`text-sm font-mono font-bold ${profile?.employee_code ? 'text-enterprise-600 dark:text-enterprise-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {profile?.employee_code || 'ยังไม่ได้ตั้งรหัส'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ตั้งหรือแก้ไขได้เฉพาะโดยผู้ดูแลระบบหรือ HR
              </p>
            </div>
          </div>
        </Card>

        {/* Account Info Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
            ข้อมูลบัญชี
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-enterprise-100 dark:bg-enterprise-900 rounded-lg">
                <User className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">User ID</p>
                <p className="text-sm font-mono text-slate-900 dark:text-white">
                  {user?.id?.substring(0, 8)}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">บทบาท</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {profile?.role ? roleLabels[profile.role] || profile.role : 'ไม่ระบุ'}
                </p>
              </div>
            </div>

            {/* ── Change Password ──────────────────────────────────── */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    รหัสผ่าน Login
                  </span>
                </div>
                {!isChangingPassword && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setIsChangingPassword(true); setPasswordError(null); setPasswordSuccess(false); }}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    เปลี่ยน
                  </Button>
                )}
              </div>

              {passwordSuccess && (
                <div className="flex items-center gap-2 p-3 mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-200">เปลี่ยนรหัสผ่านสำเร็จ</p>
                </div>
              )}

              {isChangingPassword ? (
                <div className="space-y-3">
                  {passwordError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-300">{passwordError}</p>
                    </div>
                  )}

                  {/* Current password — required for employee self-service */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      รหัสผ่านปัจจุบัน <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="รหัสผ่านที่ใช้ login อยู่ตอนนี้"
                        autoComplete="current-password"
                        className="w-full pl-8 pr-10 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      ต้องยืนยันรหัสเดิมก่อนจึงจะเปลี่ยนได้
                    </p>
                  </div>

                  {/* New password */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      รหัสผ่านใหม่ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        autoComplete="new-password"
                        className="w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {pwdStrength && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3, 4].map((n) => (
                              <div
                                key={n}
                                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                  n <= pwdStrength.bars ? pwdStrength.color : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className={`text-xs font-medium ${pwdStrength.textColor}`}>
                            {pwdStrength.label}
                          </span>
                        </div>

                        {/* Checklist */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {[
                            { rule: pwdRules.minLen, label: 'อย่างน้อย 8 ตัว' },
                            { rule: pwdRules.hasUpper, label: 'ตัวพิมพ์ใหญ่ A-Z' },
                            { rule: pwdRules.hasNumber, label: 'ตัวเลข 0-9' },
                            { rule: pwdRules.hasSpecial, label: 'อักขระพิเศษ !@#' },
                            { rule: pwdRules.notSameAsCurrent, label: 'ไม่ซ้ำรหัสเดิม' },
                          ].map(({ rule, label }) => (
                            <div key={label} className="flex items-center gap-1">
                              {rule
                                ? <Check size={11} className="text-green-500 shrink-0" />
                                : <X size={11} className="text-slate-300 dark:text-slate-600 shrink-0" />
                              }
                              <span className={`text-xs ${rule ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      ยืนยันรหัสผ่านใหม่ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                        autoComplete="new-password"
                        className={`w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500 ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-400 dark:border-red-500'
                            : confirmPassword && confirmPassword === newPassword
                              ? 'border-green-400 dark:border-green-500'
                              : 'border-slate-300 dark:border-slate-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="mt-1 text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>
                    )}
                    {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                      <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check size={11} /> รหัสผ่านตรงกัน
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleChangePassword} disabled={savingPassword} isLoading={savingPassword} size="sm">
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      บันทึก
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancelChangePassword} disabled={savingPassword}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  ••••••••••  (ไม่แสดงรหัสผ่านเพื่อความปลอดภัย)
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="danger"
                className="w-full"
                onClick={handleSignOut}
                disabled={loading}
              >
                <LogOut className="w-4 h-4 mr-2" />
                ออกจากระบบ
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

