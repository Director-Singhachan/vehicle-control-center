// Avatar Component - Display user profile picture with fallback
import React from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
    src?: string | null;
    alt?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    fallback?: string;
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    src,
    alt = 'User avatar',
    size = 'md',
    fallback,
    className = '',
}) => {
    const [imageError, setImageError] = React.useState(false);

    // Size mappings
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-16 h-16 text-lg',
        xl: 'w-24 h-24 text-2xl',
    };

    const iconSizes = {
        sm: 16,
        md: 20,
        lg: 32,
        xl: 48,
    };

    // Get initials from fallback text
    const getInitials = (text?: string): string => {
        if (!text) return '';

        const words = text.trim().split(/\s+/);
        if (words.length === 1) {
            return words[0].charAt(0).toUpperCase();
        }
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(fallback);

    // Show image if available and no error
    if (src && !imageError) {
        return (
            <div className={`${sizeClasses[size]} ${className} relative overflow-hidden rounded-full flex-shrink-0`}>
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            </div>
        );
    }

    // Show fallback (initials or icon)
    return (
        <div
            className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-enterprise-500 to-neon-blue rounded-full flex items-center justify-center text-white font-semibold shadow-md flex-shrink-0`}
        >
            {initials ? (
                <span>{initials}</span>
            ) : (
                <User size={iconSizes[size]} className="opacity-80" />
            )}
        </div>
    );
};
