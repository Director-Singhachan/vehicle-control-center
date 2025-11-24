
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageCompression';

export interface UploadProgress {
    fileName: string;
    progress: number;
    status: 'uploading' | 'complete' | 'error';
}

export const storageService = {
    /**
     * Upload a file to Supabase Storage with compression and retry logic
     * @param file The file to upload
     * @param bucket The storage bucket name (default: 'ticket-attachments')
     * @param path Optional path prefix
     * @param onProgress Optional progress callback
     * @returns The public URL of the uploaded file
     */
    uploadFile: async (
        file: File,
        bucket: string = 'ticket-attachments',
        path: string = '',
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string> => {
        const maxRetries = 3;
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Compress image if it's an image file
                let fileToUpload = file;
                if (file.type.startsWith('image/')) {
                    try {
                        if (onProgress) {
                            onProgress({
                                fileName: file.name,
                                progress: 10,
                                status: 'uploading',
                            });
                        }
                        fileToUpload = await compressImage(file);
                        console.log(`Compressed ${file.name}: ${file.size} -> ${fileToUpload.size} bytes`);
                    } catch (compressionError) {
                        console.warn('Compression failed, using original file:', compressionError);
                        fileToUpload = file;
                    }
                }

                // Create a unique file name
                const fileExt = fileToUpload.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
                const filePath = path ? `${path}/${fileName}` : fileName;

                if (onProgress) {
                    onProgress({
                        fileName: file.name,
                        progress: 30,
                        status: 'uploading',
                    });
                }

                // Upload the file with timeout
                const uploadPromise = supabase.storage
                    .from(bucket)
                    .upload(filePath, fileToUpload);

                // Add timeout (60 seconds for mobile networks)
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Upload timeout after 60s')), 60000);
                });

                const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

                if (error) {
                    throw error;
                }

                if (onProgress) {
                    onProgress({
                        fileName: file.name,
                        progress: 80,
                        status: 'uploading',
                    });
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                if (onProgress) {
                    onProgress({
                        fileName: file.name,
                        progress: 100,
                        status: 'complete',
                    });
                }

                return publicUrl;
            } catch (error: any) {
                lastError = error;
                console.error(`Upload attempt ${attempt}/${maxRetries} failed:`, error);

                // Don't retry on certain errors
                if (error.message?.includes('row-level security') ||
                    error.message?.includes('permission') ||
                    error.message?.includes('unauthorized')) {
                    throw new Error('ไม่มีสิทธิ์อัปโหลดไฟล์ กรุณาติดต่อผู้ดูแลระบบ');
                }

                // Retry on network errors
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // All retries failed
                    if (onProgress) {
                        onProgress({
                            fileName: file.name,
                            progress: 0,
                            status: 'error',
                        });
                    }
                }
            }
        }

        // Format error message based on error type
        const errorMessage = lastError?.message || 'Unknown error';

        if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
            throw new Error('การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาตรวจสอบสัญญาณและลองอีกครั้ง');
        } else if (errorMessage.includes('size') || errorMessage.includes('large')) {
            throw new Error('ไฟล์มีขนาดใหญ่เกินไป กรุณาลดขนาดไฟล์หรือเลือกไฟล์อื่น');
        } else {
            throw new Error(`เกิดข้อผิดพลาดในการอัปโหลด: ${errorMessage}`);
        }
    },

    /**
     * Upload multiple files with progress tracking
     */
    uploadFiles: async (
        files: File[],
        bucket: string = 'ticket-attachments',
        path: string = '',
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string[]> => {
        const urls: string[] = [];

        // Upload files sequentially to avoid overwhelming mobile networks
        for (const file of files) {
            const url = await storageService.uploadFile(file, bucket, path, onProgress);
            urls.push(url);
        }

        return urls;
    }
};
