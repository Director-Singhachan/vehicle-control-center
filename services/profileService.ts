// Profile Service - CRUD operations for user profiles
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const profileService = {
  // Get current user profile
  getCurrent: async (): Promise<Profile | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get profile by ID
  getById: async (id: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update current user profile
  updateCurrent: async (updates: ProfileUpdate): Promise<Profile> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update profile by ID (admin only)
  updateById: async (id: string, updates: ProfileUpdate): Promise<Profile> => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Upload avatar image to Supabase Storage
  uploadAvatar: async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ jpg, png หรือ webp');
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > maxSize) {
      throw new Error('ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 2MB');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  // Delete avatar from Supabase Storage
  deleteAvatar: async (avatarUrl: string): Promise<void> => {
    if (!avatarUrl) return;

    try {
      // Extract file path from URL
      const url = new URL(avatarUrl);
      const pathParts = url.pathname.split('/avatars/');
      if (pathParts.length < 2) return;

      const filePath = pathParts[1];

      // Delete from storage
      const { error } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (error) {
        console.warn('Failed to delete avatar from storage:', error);
      }
    } catch (err) {
      console.warn('Error deleting avatar:', err);
    }
  },

  // Update avatar (delete old, upload new, update profile)
  updateAvatar: async (file: File): Promise<Profile> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get current profile to check for existing avatar
    const currentProfile = await profileService.getCurrent();

    // Delete old avatar if exists
    if (currentProfile?.avatar_url) {
      await profileService.deleteAvatar(currentProfile.avatar_url);
    }

    // Upload new avatar
    const avatarUrl = await profileService.uploadAvatar(file);

    // Update profile with new avatar URL
    const updatedProfile = await profileService.updateCurrent({
      avatar_url: avatarUrl
    });

    return updatedProfile;
  },

  // Remove avatar (delete from storage and update profile)
  removeAvatar: async (): Promise<Profile> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get current profile
    const currentProfile = await profileService.getCurrent();

    // Delete avatar from storage if exists
    if (currentProfile?.avatar_url) {
      await profileService.deleteAvatar(currentProfile.avatar_url);
    }

    // Update profile to remove avatar URL
    const updatedProfile = await profileService.updateCurrent({
      avatar_url: null
    });

    return updatedProfile;
  },
};

