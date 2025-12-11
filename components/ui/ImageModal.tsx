// Image Modal - Display enlarged image in a modal
import React from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  imageUrl,
  alt,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/90 dark:bg-slate-800/90 rounded-full hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-lg"
          aria-label="ปิด"
        >
          <X size={24} className="text-slate-900 dark:text-slate-100" />
        </button>

        {/* Image */}
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-auto max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onError={(e) => {
            // If image fails to load, show error message
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const errorDiv = target.nextElementSibling as HTMLElement;
            if (errorDiv) errorDiv.style.display = 'flex';
          }}
        />
        
        {/* Error Message */}
        <div className="hidden items-center justify-center w-full h-64 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400">ไม่สามารถโหลดรูปภาพได้</p>
        </div>
      </div>
    </div>
  );
};

