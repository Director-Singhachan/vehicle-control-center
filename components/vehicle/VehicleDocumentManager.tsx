// VehicleDocumentManager - Manage documents for a vehicle
import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Eye,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DocumentUploadModal, type DocumentType } from './DocumentUploadModal';
import { ImageModal } from '../ui/ImageModal';
import { useVehicleDocuments } from '../../hooks/useVehicleDocuments';
import { vehicleDocumentService } from '../../services/vehicleDocumentService';
import type { DocumentWithDetails } from '../../services/vehicleDocumentService';

interface VehicleDocumentManagerProps {
  vehicleId: string;
  canEdit?: boolean;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  registration: 'ทะเบียนรถ',
  tax: 'ภาษีรถ',
  insurance: 'ประกัน',
  inspection: 'พรบ./ตรวจสภาพ',
  other: 'อื่นๆ',
};

const DOCUMENT_TYPE_ICONS: Record<DocumentType, React.ComponentType<{ className?: string; size?: number }>> = {
  registration: FileText,
  tax: FileText,
  insurance: FileText,
  inspection: FileText,
  other: FileText,
};

export const VehicleDocumentManager: React.FC<VehicleDocumentManagerProps> = ({
  vehicleId,
  canEdit = false,
}) => {
  const [activeTab, setActiveTab] = useState<DocumentType | 'all'>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadDocumentType, setUploadDocumentType] = useState<DocumentType>('registration');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string; type: string } | null>(null);

  const { documents, loading, error, refetch } = useVehicleDocuments({
    vehicleId,
    documentType: activeTab === 'all' ? undefined : activeTab,
    autoFetch: true,
  });

  // Calculate document status
  const getDocumentStatus = (doc: DocumentWithDetails) => {
    if (doc.status === 'expired') {
      return {
        label: 'หมดอายุ',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: AlertTriangle,
      };
    }

    if (!doc.expiry_date) {
      return {
        label: 'ใช้งาน',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: CheckCircle,
      };
    }

    const today = new Date();
    const expiryDate = new Date(doc.expiry_date);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return {
        label: 'หมดอายุ',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: AlertTriangle,
      };
    }

    if (daysUntilExpiry <= (doc.remind_before_days || 30)) {
      return {
        label: `เหลือ ${daysUntilExpiry} วัน`,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: Clock,
      };
    }

    return {
      label: 'ใช้งาน',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: CheckCircle,
    };
  };

  // Group documents by type
  const documentsByType = useMemo(() => {
    const grouped: Record<DocumentType, DocumentWithDetails[]> = {
      registration: [],
      tax: [],
      insurance: [],
      inspection: [],
      other: [],
    };

    documents.forEach((doc) => {
      if (doc.document_type in grouped) {
        grouped[doc.document_type as DocumentType].push(doc);
      }
    });

    return grouped;
  }, [documents]);

  const handleUploadClick = (type: DocumentType) => {
    setUploadDocumentType(type);
    setUploadModalOpen(true);
  };

  const handleUploadSuccess = () => {
    refetch();
    setUploadModalOpen(false);
  };

  const handleViewDocument = (url: string) => {
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      setViewingImage(url);
    } else {
      // Open PDF in new tab
      window.open(url, '_blank');
    }
  };

  const handleDeleteClick = (doc: DocumentWithDetails) => {
    setDocumentToDelete({
      id: doc.id,
      name: doc.file_name,
      type: DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType],
    });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    setDeletingId(documentToDelete.id);
    setDeleteConfirmOpen(false);
    
    try {
      await vehicleDocumentService.deleteDocument(documentToDelete.id);
      refetch();
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('เกิดข้อผิดพลาดในการลบเอกสาร');
    } finally {
      setDeletingId(null);
      setDocumentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDocumentToDelete(null);
  };

  if (loading && documents.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">กำลังโหลดเอกสาร...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      </Card>
    );
  }

  const tabs: Array<{ value: DocumentType | 'all'; label: string }> = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'registration', label: DOCUMENT_TYPE_LABELS.registration },
    { value: 'tax', label: DOCUMENT_TYPE_LABELS.tax },
    { value: 'insurance', label: DOCUMENT_TYPE_LABELS.insurance },
    { value: 'inspection', label: DOCUMENT_TYPE_LABELS.inspection },
    { value: 'other', label: DOCUMENT_TYPE_LABELS.other },
  ];

  const displayDocuments = activeTab === 'all' ? documents : documentsByType[activeTab];

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            เอกสารรถ
          </h2>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setUploadDocumentType('registration');
                setUploadModalOpen(true);
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              อัปโหลดเอกสาร
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const count = tab.value === 'all' 
              ? documents.length 
              : documentsByType[tab.value as DocumentType].length;
            
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.value
                    ? 'bg-enterprise-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Documents List */}
        {displayDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              ยังไม่มีเอกสาร{activeTab !== 'all' ? `ประเภท${DOCUMENT_TYPE_LABELS[activeTab as DocumentType]}` : ''}
            </p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadDocumentType(activeTab === 'all' ? 'registration' : (activeTab as DocumentType));
                  setUploadModalOpen(true);
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                อัปโหลดเอกสาร
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayDocuments.map((doc) => {
              const status = getDocumentStatus(doc);
              const StatusIcon = status.icon;
              const TypeIcon = DOCUMENT_TYPE_ICONS[doc.document_type as DocumentType];

              return (
                <div
                  key={doc.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <TypeIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType]}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        <p className="font-medium text-slate-900 dark:text-white">{doc.file_name}</p>
                        {doc.issued_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>ออกเมื่อ: {new Date(doc.issued_date).toLocaleDateString('th-TH')}</span>
                          </div>
                        )}
                        {doc.expiry_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>หมดอายุ: {new Date(doc.expiry_date).toLocaleDateString('th-TH')}</span>
                          </div>
                        )}
                        {doc.notes && (
                          <p className="text-slate-500 dark:text-slate-400">{doc.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(doc.file_url)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUploadDocumentType(doc.document_type as DocumentType);
                              setUploadModalOpen(true);
                            }}
                            title="อัปโหลดเวอร์ชันใหม่"
                          >
                            <Upload className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(doc)}
                            disabled={deletingId === doc.id}
                            title="ลบเอกสาร"
                          >
                            {deletingId === doc.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        vehicleId={vehicleId}
        documentType={uploadDocumentType}
        onUploaded={handleUploadSuccess}
      />

      {/* Image Viewer Modal */}
      <ImageModal
        isOpen={!!viewingImage}
        imageUrl={viewingImage || ''}
        alt="Document preview"
        onClose={() => setViewingImage(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="ยืนยันการลบเอกสาร"
        message={
          documentToDelete ? (
            <>
              คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?
              <br />
              <br />
              <span className="font-semibold text-slate-900 dark:text-white">
                {documentToDelete.type}: {documentToDelete.name}
              </span>
              <br />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                การกระทำนี้ไม่สามารถยกเลิกได้
              </span>
            </>
          ) : (
            'คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?'
          )
        }
        confirmText="ลบ"
        cancelText="ยกเลิก"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
};
