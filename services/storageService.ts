
import { supabase } from '../lib/supabase';

export const storageService = {
    /**
     * Upload a file to Supabase Storage
     * @param file The file to upload
     * @param bucket The storage bucket name (default: 'ticket-attachments')
     * @param path Optional path prefix
     * @returns The public URL of the uploaded file
     */
    uploadFile: async (file: File, bucket: string = 'ticket-attachments', path: string = ''): Promise<string> => {
        try {
            // Create a unique file name
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const filePath = path ? `${path}/${fileName}` : fileName;

            // Upload the file
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    },

    /**
     * Upload multiple files
     */
    uploadFiles: async (files: File[], bucket: string = 'ticket-attachments', path: string = ''): Promise<string[]> => {
        const uploadPromises = files.map(file => storageService.uploadFile(file, bucket, path));
        return Promise.all(uploadPromises);
    }
};
