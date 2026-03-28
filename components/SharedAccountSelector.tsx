import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Button } from './ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Users, CheckCircle } from 'lucide-react';

type ServiceStaff = import('../types/database').Database['public']['Tables']['service_staff']['Row'];

export const SharedAccountSelector: React.FC = () => {
  const { 
    profile, 
    availableStaff, 
    activeStaff, 
    setActiveStaff,
    user 
  } = useAuthStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ServiceStaff | null>(null);

  const isSharedAccount = profile?.is_shared_account ?? false;

  useEffect(() => {
    // Open the modal if it's a shared account, the user is logged in,
    // and no active staff member has been selected yet.
    if (isSharedAccount && user && !activeStaff && availableStaff.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isSharedAccount, user, activeStaff, availableStaff.length]);

  const handleSelectStaff = (staff: ServiceStaff) => {
    setSelectedStaff(staff);
  };

  const handleConfirmSelection = () => {
    if (selectedStaff) {
      setActiveStaff(selectedStaff);
      setIsOpen(false);
      // Optionally, you could log this selection to the new audit table
      // supabase.from('shared_account_activity_log').insert(...)
    }
  };

  // Prevent closing the dialog by clicking outside or pressing Escape
  const handleInteractOutside = (event: Event) => {
    event.preventDefault();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleInteractOutside}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="text-blue-500" />
            Who is using this account?
          </DialogTitle>
          <DialogDescription>
            Please select your name to continue. This is required for logging your activities correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {availableStaff.map((staff) => (
            <button
              key={staff.id}
              onClick={() => handleSelectStaff(staff)}
              className={`w-full text-left p-3 rounded-lg border flex items-center justify-between transition-all ${
                selectedStaff?.id === staff.id
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700'
              }`}
            >
              <div>
                <p className="font-semibold">{staff.name_prefix} {staff.name}</p>
                <p className="text-sm text-slate-500">
                  Employee ID: {staff.employee_code}
                </p>
              </div>
              {selectedStaff?.id === staff.id && (
                <CheckCircle className="text-blue-500" size={20} />
              )}
            </button>
          ))}
        </div>

        <Button 
          onClick={handleConfirmSelection} 
          disabled={!selectedStaff}
          className="w-full"
        >
          Confirm and Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
};
