// Profile View - User profile management
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks';
import { profileService } from '../services/profileService';
import { User, Mail, Shield, LogOut, Save, Edit2, AlertCircle, Camera, Trash2, Upload } from 'lucide-react';
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

