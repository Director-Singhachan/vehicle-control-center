/**
 * Image Compression Utility
 * Compresses images before upload to reduce file size and improve upload speed on mobile
 */

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
}

export interface CompressionProgress {
    fileName: string;
    progress: number; // 0-100
    status: 'compressing' | 'complete' | 'error';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    mimeType: 'image/jpeg',
};

/**
 * Compress a single image file
 * @param file The image file to compress
 * @param options Compression options
 * @returns Compressed file
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Skip compression for non-image files
    if (!file.type.startsWith('image/')) {
        return file;
    }

    // Skip compression for small files (< 500KB)
    if (file.size < 500 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Failed to read file'));

        reader.onload = (e) => {
            const img = new Image();

            img.onerror = () => reject(new Error('Failed to load image'));

            img.onload = () => {
                try {
                    // Calculate new dimensions while maintaining aspect ratio
                    let { width, height } = img;

                    if (width > opts.maxWidth || height > opts.maxHeight) {
                        const aspectRatio = width / height;

                        if (width > height) {
                            width = opts.maxWidth;
                            height = width / aspectRatio;
                        } else {
                            height = opts.maxHeight;
                            width = height * aspectRatio;
                        }
                    }

                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Use better image smoothing for quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // Draw image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }

                            // Create new file from blob
                            const compressedFile = new File(
                                [blob],
                                file.name.replace(/\.[^/.]+$/, '.jpg'), // Change extension to .jpg
                                {
                                    type: opts.mimeType,
                                    lastModified: Date.now(),
                                }
                            );

                            // Only use compressed version if it's actually smaller
                            if (compressedFile.size < file.size) {
                                resolve(compressedFile);
                            } else {
                                resolve(file);
                            }
                        },
                        opts.mimeType,
                        opts.quality
                    );
                } catch (error) {
                    reject(error);
                }
            };

            img.src = e.target?.result as string;
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Compress multiple image files
 * @param files Array of files to compress
 * @param options Compression options
 * @param onProgress Progress callback
 * @returns Array of compressed files
 */
export async function compressImages(
    files: File[],
    options: CompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
): Promise<File[]> {
    const compressedFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
            // Report progress
            if (onProgress) {
                onProgress({
                    fileName: file.name,
                    progress: (i / files.length) * 100,
                    status: 'compressing',
                });
            }

            const compressed = await compressImage(file, options);
            compressedFiles.push(compressed);

            // Report completion
            if (onProgress) {
                onProgress({
                    fileName: file.name,
                    progress: ((i + 1) / files.length) * 100,
                    status: 'complete',
                });
            }
        } catch (error) {
            console.error(`Failed to compress ${file.name}:`, error);

            // Report error
            if (onProgress) {
                onProgress({
                    fileName: file.name,
                    progress: ((i + 1) / files.length) * 100,
                    status: 'error',
                });
            }

            // Use original file if compression fails
            compressedFiles.push(file);
        }
    }

    return compressedFiles;
}

/**
 * Get human-readable file size
 * @param bytes File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
