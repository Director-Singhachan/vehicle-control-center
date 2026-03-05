// Profile View - User profile management
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks';
import { profileService } from '../services/profileService';
import { User, Shield, LogOut, Save, Edit2, AlertCircle, Camera, Trash2, Upload, Hash, CheckCircle2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Avatar } from '../components/ui/Avatar';

export const ProfileView: React.FC = () => {
  const { user, profile, signOut, refreshProfile, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Login password change
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Employee code self-edit
  const [employeeCode, setEmployeeCode] = useState(profile?.employee_code || '');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState(false);

  // Avatar upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local state when profile changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || user?.email || '');
      setEmployeeCode(profile.employee_code || '');
    }
  }, [profile, user]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await profileService.updateCurrent({
        full_name: fullName || null,
      });
      setSuccess(true);
      setIsEditing(false);
      refreshProfile();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!newPassword) {
      setPasswordError('กรุณาระบุรหัสผ่านใหม่');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }
    setSavingPassword(true);
    setPasswordSuccess(false);
    try {
      await profileService.changePassword(newPassword);
      setPasswordSuccess(true);
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
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
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError(null);
  };

  const handleSaveEmployeeCode = async () => {
    const trimmed = employeeCode.trim();
    if (!trimmed) {
      setCodeError('กรุณาระบุรหัสพนักงาน');
      return;
    }
    if (!/^[a-zA-Z0-9]{2,20}$/.test(trimmed)) {
      setCodeError('รหัสต้องประกอบด้วยตัวเลขและตัวอักษรเท่านั้น (ความยาว 2–20 ตัว)');
      return;
    }
    setSavingCode(true);
    setCodeError(null);
    setCodeSuccess(false);
    try {
      await profileService.setOwnEmployeeCode(trimmed);
      setCodeSuccess(true);
      setIsEditingCode(false);
      refreshProfile();
      setTimeout(() => setCodeSuccess(false), 4000);
    } catch (err: any) {
      setCodeError(err.message || 'บันทึกรหัสพนักงานไม่สำเร็จ');
    } finally {
      setSavingCode(false);
    }
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
    user: 'ผู้ใช้',
    inspector: 'ผู้ตรวจสอบ',
    manager: 'ผู้จัดการ',
    executive: 'ผู้บริหาร',
    admin: 'ผู้ดูแลระบบ',
    sales: 'ฝ่ายขาย',
    driver: 'พนักงานขับรถ',
    service_staff: 'พนักงานบริการ',
  };

  return (
    <PageLayout
      title="ข้อมูลส่วนตัว"
      subtitle="จัดการข้อมูลโปรไฟล์ของคุณ"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              ข้อมูลส่วนตัว
            </h2>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            )}
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
                value={email}
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isEditing}
                placeholder="กรุณากรอกชื่อ-นามสกุล"
              />
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving} isLoading={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  บันทึก
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFullName(profile?.full_name || '');
                    setError(null);
                    setSuccess(false);
                  }}
                  disabled={saving}
                >
                  ยกเลิก
                </Button>
              </div>
            )}

            {/* ── Employee Code ─────────────────────────────────────────── */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  รหัสพนักงาน
                </label>
                {!isEditingCode && (
                  <Button variant="outline" size="sm" onClick={() => { setIsEditingCode(true); setCodeError(null); setCodeSuccess(false); }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    {profile?.employee_code ? 'เปลี่ยนรหัส' : 'ตั้งรหัส'}
                  </Button>
                )}
              </div>

              {codeSuccess && (
                <div className="flex items-center gap-2 p-3 mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-200">บันทึกรหัสพนักงานสำเร็จ</p>
                </div>
              )}

              {codeError && (
                <div className="flex items-start gap-2 p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-200">{codeError}</p>
                </div>
              )}

              {isEditingCode ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      placeholder="เช่น 000123 หรือ EMP001"
                      maxLength={20}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    รหัสพนักงานต้องเป็นตัวเลขหรือตัวอักษรภาษาอังกฤษเท่านั้น ความยาว 2–20 ตัว
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEmployeeCode} disabled={savingCode} isLoading={savingCode} size="sm">
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      บันทึกรหัส
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setIsEditingCode(false); setEmployeeCode(profile?.employee_code || ''); setCodeError(null); }}
                      disabled={savingCode}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className={`text-sm font-mono font-bold ${profile?.employee_code ? 'text-enterprise-600 dark:text-enterprise-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {profile?.employee_code || 'ยังไม่ได้ตั้งรหัส'}
                  </span>
                </div>
              )}
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
                        className={`w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500 ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-400 dark:border-red-500'
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

