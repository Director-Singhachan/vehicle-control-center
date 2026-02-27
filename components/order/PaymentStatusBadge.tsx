import React from 'react';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Check, AlertCircle, Info, Ban } from 'lucide-react';

export type PaymentStatus = 'ชำระแล้ว' | 'รอชำระ' | 'นัดชำระหนี้คงค้างเรียบร้อยแล้ว' | 'รอชำระหนี้คงค้าง';

interface PaymentStatusBadgeProps {
    status: PaymentStatus | string | null;
    showIcon?: boolean;
}

export function PaymentStatusBadge({ status, showIcon = true }: PaymentStatusBadgeProps) {
    if (!status) return null;

    let variant: BadgeVariant = 'default';
    let icon = null;
    let label = status;

    switch (status) {
        case 'ชำระแล้ว':
            variant = 'success';
            icon = <Check className="w-3 h-3" />;
            label = '✅ ชำระแล้ว (จัดส่งได้ปกติ)';
            break;
        case 'รอชำระ':
            variant = 'error';
            icon = <AlertCircle className="w-3 h-3" />;
            label = '⚠️ รอชำระ (สั่งได้ แต่ห้ามขึ้นรถ)';
            break;
        case 'นัดชำระหนี้คงค้างเรียบร้อยแล้ว':
            variant = 'warning';
            icon = <Info className="w-3 h-3" />;
            label = 'ℹ️ นัดชำระแล้ว (จัดส่งได้ปกติ)';
            break;
        case 'รอชำระหนี้คงค้าง':
            variant = 'error';
            // สำหรับสีแดงเข้ม เราจะใช้ variant error แล้วเสริม className
            icon = <Ban className="w-3 h-3" />;
            label = '⛔ หนี้คงค้าง (สั่งได้ แต่ห้ามขึ้นรถ)';
            break;
        default:
            return null;
    }

    return (
        <Badge
            variant={variant}
            className={`flex items-center gap-1 ${status === 'รอชำระหนี้คงค้าง' ? 'bg-red-200 text-red-900 border border-red-300' : ''}`}
        >
            {showIcon && icon}
            {label}
        </Badge>
    );
}
