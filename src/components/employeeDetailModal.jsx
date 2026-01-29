import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Phone, Mail, MapPin, Award, Cake, Network, Calendar, DollarSign, User, ClipboardList, FileText, Download, Upload, Loader, Edit2, Briefcase, Trash2, RefreshCw, Eye, ExternalLink, Files, ListFilter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useUpload } from '../contexts/UploadContext';
import { getEmployeePdfUrl, deleteEmployeePdf, uploadEmployeeRequestDocument, listEmployeeRequestDocuments, deleteEmployeeRequestDocument, getEmployeeRequestDocumentUrl } from '../services/employeeService';
import { getDemoEmployeeName } from '../utils/demoHelper';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const EmployeeDetailModal = ({ employee, onClose, onUpdate, onEdit }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { startPdfUpload, getUploadStatus } = useUpload();
  
  // Check if user has permission to edit (not employee role)
  const canEdit = user?.role !== 'employee';
  const canUploadRequestDocs = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'contact', 'documents'
  const [documentsSubTab, setDocumentsSubTab] = useState('pdf'); // 'pdf' | 'requests'
  const [pdfPath, setPdfPath] = useState(employee?.pdf_document_url || null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [modalWidth, setModalWidth] = useState(900);
  const [isResizing, setIsResizing] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [useIframe, setUseIframe] = useState(true); // Use iframe by default
  const modalRef = useRef(null);
  const resizeRef = useRef(null);

  // Request docs state
  const [requestDocs, setRequestDocs] = useState([]);
  const [requestDocsLoading, setRequestDocsLoading] = useState(false);
  const [requestDocsError, setRequestDocsError] = useState(null);
  const [requestDocCategory, setRequestDocCategory] = useState('leave');
  const [requestDocUpload, setRequestDocUpload] = useState({ status: 'idle', progress: 0, error: null });
  const [requestDocPreview, setRequestDocPreview] = useState({ status: 'idle', doc: null, url: null, error: null });
  const [requestDocsAutoPreviewArmed, setRequestDocsAutoPreviewArmed] = useState(true);
  
  // Get upload status from context
  const uploadStatus = getUploadStatus(employee?.id);

  if (!employee) return null;

  // Generate URL from file path on mount with fallback
  useEffect(() => {
    const generatePdfUrl = async () => {
      if (!pdfPath) return;

      console.log('🔍 Generating PDF URL for path:', pdfPath);

      try {
        // Use service function to get URL
        const result = await getEmployeePdfUrl(pdfPath);
        
        if (result.success) {
          console.log('✅ PDF URL generated:', result.url, 'Type:', result.type);
          setPdfUrl(result.url);
          setPdfError(null);
        } else {
          console.error('❌ Failed to get PDF URL:', result.error);
          setPdfError(result.error);
        }
      } catch (error) {
        console.error('❌ Error generating PDF URL:', error);
        setPdfError('Failed to load PDF document');
      }
    };

    generatePdfUrl();
  }, [pdfPath]);

  // Update pdfPath when employee prop changes (persisted demo updates)
  useEffect(() => {
    if ((employee?.pdf_document_url || null) !== pdfPath) {
      setPdfPath(employee?.pdf_document_url || null);
    }
  }, [employee?.pdf_document_url]);

  const loadRequestDocs = async () => {
    if (!employee?.id) return;
    setRequestDocsLoading(true);
    setRequestDocsError(null);
    try {
      const result = await listEmployeeRequestDocuments(employee.id);
      if (result.success) {
        setRequestDocs(result.data || []);
      } else {
        setRequestDocsError(result.error || 'Failed to load documents');
      }
    } catch (err) {
      setRequestDocsError(err?.message || 'Failed to load documents');
    } finally {
      setRequestDocsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'documents') return;
    if (documentsSubTab !== 'requests') return;
    // Arm auto-preview when entering the Requests sub-tab or switching employees.
    setRequestDocsAutoPreviewArmed(true);
    loadRequestDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, documentsSubTab, employee?.id]);

  // Cleanup preview when switching away
  useEffect(() => {
    setRequestDocPreview((prev) => {
      if (prev?.url && typeof prev.url === 'string' && prev.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          // ignore
        }
      }
      return { status: 'idle', doc: null, url: null, error: null };
    });
  }, [activeTab, documentsSubTab, employee?.id]);
  
  // Update PDF path when upload completes
  useEffect(() => {
    if (uploadStatus?.status === 'completed' && uploadStatus.result) {
      console.log('✅ Upload completed, updating PDF view');
      setPdfPath(uploadStatus.result.path);
      setPdfUrl(uploadStatus.result.url);
      setPageNumber(1);
      setNumPages(null);
      setPdfError(null);
    }
  }, [uploadStatus]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Resizable width handler
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      e.preventDefault();
      e.stopPropagation();
      const newWidth = e.clientX - modalRef.current.getBoundingClientRect().left;
      if (newWidth >= 600 && newWidth <= 1400) {
        setModalWidth(newWidth);
      }
    };

    const handleMouseUp = (e) => {
      if (isResizing) {
        e.preventDefault();
        e.stopPropagation();
        // Small delay to prevent backdrop click from triggering
        setTimeout(() => {
          setIsResizing(false);
        }, 50);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { capture: true, passive: false });
      window.addEventListener('mouseup', handleMouseUp, { capture: true, passive: false });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, [isResizing]);

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('📁 File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    if (file.type !== 'application/pdf') {
      alert(t('errors.invalidFileType', 'Please select a PDF file'));
      return;
    }

    // Start background upload using context
    // This will continue even if modal closes!
    startPdfUpload(file, employee.id, (result) => {
      if (result.success) {
        console.log('🎉 Upload completed successfully!');
        if (onUpdate) onUpdate();
        alert(t('success.pdfUploaded', 'PDF document uploaded successfully!'));
      } else {
        console.error('❌ Upload failed:', result.error);
        alert(t('errors.uploadFailed', 'Failed to upload PDF: ') + result.error);
      }
    });

    // Reset file input
    e.target.value = '';
  };

  const handleRequestDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRequestDocUpload({ status: 'uploading', progress: 0, error: null });

    try {
      const result = await uploadEmployeeRequestDocument(
        file,
        employee.id,
        requestDocCategory,
        (percent) => setRequestDocUpload((prev) => ({ ...prev, progress: percent }))
      );

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setRequestDocUpload({ status: 'completed', progress: 100, error: null });
      await loadRequestDocs();
      alert(t('employeeDetailModal.requestDocUploaded', 'Document uploaded successfully!'));
    } catch (err) {
      setRequestDocUpload({ status: 'error', progress: 0, error: err?.message || 'Upload failed' });
      alert(t('errors.uploadFailed', 'Failed to upload: ') + (err?.message || 'Unknown error'));
    } finally {
      e.target.value = '';
      setTimeout(() => {
        setRequestDocUpload((prev) => (prev.status === 'completed' ? { status: 'idle', progress: 0, error: null } : prev));
      }, 1200);
    }
  };

  const isPreviewableImageName = (name) => {
    if (!name || typeof name !== 'string') return false;
    const lowered = name.toLowerCase();
    const ext = lowered.includes('.') ? lowered.split('.').pop() : '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  };

  const handleRequestDocOpen = async (doc) => {
    try {
      const result = await getEmployeeRequestDocumentUrl(doc.path);
      if (!result.success) throw new Error(result.error || 'Failed to open document');
      window.open(result.url, '_blank');
    } catch (err) {
      alert(t('errors.fileOpenFailed', 'Failed to open document: ') + (err?.message || 'Unknown error'));
    }
  };

  const handleRequestDocPreview = async (doc) => {
    try {
      setRequestDocPreview((prev) => {
        if (prev?.url && typeof prev.url === 'string' && prev.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(prev.url);
          } catch {
            // ignore
          }
        }
        return { status: 'loading', doc, url: null, error: null };
      });

      const result = await getEmployeeRequestDocumentUrl(doc.path);
      if (!result.success) throw new Error(result.error || 'Failed to open document');

      setRequestDocPreview({ status: 'ready', doc, url: result.url, error: null });
    } catch (err) {
      setRequestDocPreview({ status: 'error', doc, url: null, error: err?.message || 'Failed to preview' });
    }
  };

  const clearRequestDocPreview = () => {
    // If the user collapses the preview, don't immediately auto-open it again.
    setRequestDocsAutoPreviewArmed(false);
    setRequestDocPreview((prev) => {
      if (prev?.url && typeof prev.url === 'string' && prev.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          // ignore
        }
      }
      return { status: 'idle', doc: null, url: null, error: null };
    });
  };

  const handleRequestDocDelete = async (doc) => {
    const confirmDelete = window.confirm(
      t('employeeDetailModal.confirmDelete', 'Are you sure you want to delete this document?')
    );
    if (!confirmDelete) return;

    try {
      const result = await deleteEmployeeRequestDocument(employee.id, doc.path);
      if (!result.success) throw new Error(result.error || 'Delete failed');
      await loadRequestDocs();
      alert(t('employeeDetailModal.documentDeleted', 'Document deleted successfully'));
    } catch (err) {
      alert(t('employeeDetailModal.documentDeleteError', 'Failed to delete document') + ': ' + (err?.message || ''));
    }
  };

  const formattedRequestDocs = useMemo(() => {
    return (requestDocs || []).map((doc) => {
      const dateValue = doc.updatedAt || doc.createdAt;
      const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString() : '';
      const sizeLabel = typeof doc.size === 'number' ? `${Math.round(doc.size / 1024)} KB` : '';
      return { ...doc, dateLabel, sizeLabel };
    });
  }, [requestDocs]);

  // Auto-open preview on initial load (first previewable image).
  useEffect(() => {
    if (activeTab !== 'documents' || documentsSubTab !== 'requests') return;
    if (!requestDocsAutoPreviewArmed) return;
    if (requestDocPreview.status !== 'idle') return;
    if (!formattedRequestDocs?.length) return;

    const sorted = [...formattedRequestDocs].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    const firstImage = sorted.find((doc) => isPreviewableImageName(doc?.originalName || doc?.name));
    if (!firstImage) {
      setRequestDocsAutoPreviewArmed(false);
      return;
    }

    setRequestDocsAutoPreviewArmed(false);
    handleRequestDocPreview(firstImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, documentsSubTab, formattedRequestDocs, requestDocsAutoPreviewArmed, requestDocPreview.status]);

  const handlePdfDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handlePdfDelete = async () => {
    if (!pdfPath) return;

    const confirmDelete = window.confirm(
      t('employeeDetailModal.confirmDeletePdf', 'Are you sure you want to delete this PDF document? This action cannot be undone.')
    );

    if (!confirmDelete) return;

    console.log('🗑️ Deleting PDF:', pdfPath);

    try {
      const result = await deleteEmployeePdf(employee.id, pdfPath);
      
      if (result.success) {
        console.log('✅ PDF deleted successfully');
        setPdfPath(null);
        setPdfUrl(null);
        setNumPages(null);
        setPageNumber(1);
        setPdfError(null);
        
        if (onUpdate) onUpdate();
        alert(t('success.pdfDeleted', 'PDF document deleted successfully!'));
      } else {
        console.error('❌ Delete failed:', result.error);
        alert(t('errors.deleteFailed', 'Failed to delete PDF: ') + result.error);
      }
    } catch (error) {
      console.error('❌ Error deleting PDF:', error);
      alert(t('errors.deleteFailed', 'Failed to delete PDF: ') + error.message);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPdfError(null);
  };

  const onDocumentLoadError = (error) => {
    console.error('❌ PDF.js load error:', error);
    console.error('PDF URL:', pdfUrl);
    setPdfError('Failed to load PDF with pdf.js. Switching to iframe viewer...');
    // Auto-switch to iframe on error
    setTimeout(() => {
      setUseIframe(true);
      setPdfError(null);
    }, 1500);
  };

  // Calculate work duration
  const calculateWorkDuration = () => {
    if (!employee.start_date && !employee.startDate) return t('employeeDetailModal.workDurationNA', 'N/A');
    const startDate = new Date(employee.start_date || employee.startDate);
    const now = new Date();
    
    let years = now.getFullYear() - startDate.getFullYear();
    let months = now.getMonth() - startDate.getMonth();
    
    // Adjust for negative months
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    
    const totalMonths = years * 12 + months;

    const yearUnit = (value) => (value === 1 ? t('employeeDetailModal.yearUnit', 'year') : t('employeeDetailModal.yearsUnit', 'years'));
    const monthUnit = (value) => (value === 1 ? t('employeeDetailModal.monthUnit', 'month') : t('employeeDetailModal.monthsUnit', 'months'));
    const unitSep = t('employeeDetailModal.durationUnitSeparator', ' ');
    const partSep = t('employeeDetailModal.durationPartSeparator', ' ');
    
    if (totalMonths >= 12) {
      if (months === 0) {
        return `${years}${unitSep}${yearUnit(years)}`;
      }
      return `${years}${unitSep}${yearUnit(years)}${partSep}${months}${unitSep}${monthUnit(months)}`;
    }
    return `${totalMonths}${unitSep}${monthUnit(totalMonths)}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (!isResizing && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className={`${bg.secondary} rounded-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col relative`}
        style={{ width: `${modalWidth}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500 transition-colors z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-transparent transition-colors"
        >
          <X className="w-5 h-5 cursor-pointer " style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
        </button>

        {/* Header Section */}
        <div className={`${bg.primary} p-8 text-center`}>
          {/* Profile Photo */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-4 shadow-lg ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-white'}`}>
                {employee.photo ? (
                  <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              {/* Online Status Indicator */}
              <div className={`absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-2 ${isDarkMode ? 'border-gray-600' : 'border-white'}`}></div>
            </div>
          </div>

          {/* Name & Position */}
          <h2 className={`text-2xl font-bold ${text.primary} mb-1`}>
            {getDemoEmployeeName(employee, t)}
          </h2>
          <p className={`${text.secondary} mb-4`}>
            {t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)}
          </p>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3">
            <a
              href={`mailto:${employee.email}`}
              style={{
                padding: '12px',
                backgroundColor: isDarkMode ? '#transparent' : '#eff6ff',
                color: isDarkMode ? '#93c5fd' : '#2563eb',
                borderRadius: '8px',
                transition: 'all 0.3s',
                display: 'inline-flex',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#dbeafe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'transparent' : '#eff6ff';
              }}
              title={t('employees.sendEmail', 'Send Email')}
            >
              <Mail className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-blue-600'}`} />
            </a>
            <a
              href={`tel:${employee.phone}`}
              style={{
                padding: '12px',
                backgroundColor: isDarkMode ? '#transparent' : '#eff6ff',
                color: isDarkMode ? '#93c5fd' : '#2563eb',
                borderRadius: '8px',
                transition: 'all 0.3s',
                display: 'inline-flex',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#dbeafe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'transparent' : '#eff6ff';
              }}
              title={t('employees.call', 'Call')}
            >
              <Phone className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-blue-600'}`} />
            </a>
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) {
                    onEdit(employee);
                    onClose();
                  }
                }}
                style={{
                  padding: '12px',
                  backgroundColor: isDarkMode ? '#transparent' : '#eff6ff',
                  color: isDarkMode ? '#93c5fd' : '#2563eb',
                  borderRadius: '8px',
                  transition: 'all 0.3s',
                  display: 'inline-flex',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#dbeafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'transparent' : '#eff6ff';
                }}
                title={t('employees.edit', 'Edit')}
              >
                <Edit2 className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-blue-600'}`} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className={`mx-6 -mt-6 mb-4 ${bg.secondary} border ${border.primary} rounded-lg p-4 shadow-lg`}>
          <div className="flex items-center space-x-2 mb-3">
            <Briefcase className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} />
            <h3 className={`font-semibold ${text.primary}`}>
              {t('employeeDetailModal.quickStats', 'Quick Stats')}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employeeDetailModal.status', 'Status')}
              </span>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                {t(`employeeStatus.${employee.status.toLowerCase().replace(' ', '')}`, employee.status)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employeeDetailModal.workDuration', 'Work Duration')}
              </span>
              <span className={`text-sm font-semibold ${text.primary}`}>
                {calculateWorkDuration()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employeeDetailModal.performance', 'Performance')}
              </span>
              <span className="text-sm font-semibold text-yellow-600 flex items-center">
                {employee.performance}/5.0 ⭐
              </span>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className={`flex border-b ${border.primary} px-6`}>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center cursor-pointer space-x-2 px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'info'
                ? `${text.primary} border-b-2 border-blue-600`
                : `${text.secondary} hover:${text.primary}`
            }`}
          >
            <User className="w-4 h-4" />
            <span>{t('employeeDetailModal.basicInfo', '')}</span>
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`flex items-center cursor-pointer space-x-2 px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'contact'
                ? `${text.primary} border-b-2 border-blue-600`
                : `${text.secondary} hover:${text.primary}`
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>{t('employeeDetailModal.contact', '')}</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center cursor-pointer space-x-2 px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'documents'
                ? `${text.primary} border-b-2 border-blue-600`
                : `${text.secondary} hover:${text.primary}`
            }`}
          >
            <FileText className={`w-4 h-4 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} />
            <span>{t('employeeDetailModal.documents', '')}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {/* Basic Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <InfoItem icon={ClipboardList} label={t('employeeDetailModal.fullName', 'Full Name')} value={getDemoEmployeeName(employee, t)} />
              <InfoItem icon={Network} label={t('employeeDetailModal.department', 'Department')} 
                value={t(`employeeDepartment.${employee.department?.toLowerCase().replace(' ', '')}`, employee.department)} />
              <InfoItem icon={Award} label={t('employeeDetailModal.position', 'Position')} 
                value={t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)} />
              <InfoItem icon={Cake} label={t('employeeDetailModal.dateOfBirth', 'Date of Birth')} value={employee.dob} />
              <InfoItem icon={Calendar} label={t('employeeDetailModal.startDate', 'Start Date')} 
                value={employee.start_date || employee.startDate || 'N/A'} />
              <InfoItem icon={DollarSign} label={t('employeeDetailModal.salary', 'Salary')} 
                value={`$${employee.salary?.toLocaleString() || 'N/A'}`} />
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <InfoItem icon={Mail} label={t('employeeDetailModal.email', 'Email')} value={employee.email} />
              <InfoItem icon={Phone} label={t('employeeDetailModal.phone', 'Phone Number')} value={employee.phone} />
              <InfoItem icon={MapPin} label={t('employeeDetailModal.address', 'Address')} value={employee.address || 'N/A'} />
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex rounded-lg border overflow-hidden ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                    <button
                      type="button"
                      onClick={() => setDocumentsSubTab('pdf')}
                      className={`px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                        documentsSubTab === 'pdf'
                          ? isDarkMode
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-900 text-white'
                          : isDarkMode
                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      title={t('employeeDetailModal.pdfTab', 'PDF')}
                      aria-label={t('employeeDetailModal.pdfTab', 'PDF')}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('employeeDetailModal.pdfTab', 'PDF')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocumentsSubTab('requests')}
                      className={`px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                        documentsSubTab === 'requests'
                          ? isDarkMode
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-900 text-white'
                          : isDarkMode
                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      title={t('employeeDetailModal.requestDocsTab', 'Requests')}
                      aria-label={t('employeeDetailModal.requestDocsTab', 'Requests')}
                    >
                      <Files className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('employeeDetailModal.requestDocsTab', 'Requests')}</span>
                    </button>
                  </div>
                </div>

                {/* Right side actions vary per sub-tab */}
                {documentsSubTab === 'pdf' ? (
                  <div className="flex space-x-2">
                    {pdfUrl && (
                      <>
                        <button
                          onClick={handlePdfDownload}
                          className={`px-4 py-2 text-white cursor-pointer rounded-lg flex items-center space-x-2 text-sm transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          <Download className="w-4 h-4" />
                          <span>{t('employeeDetailModal.download', 'Download')}</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={handlePdfDelete}
                            className={`px-4 py-2 text-white cursor-pointer rounded-lg flex items-center space-x-2 text-sm transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-700'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{t('employeeDetailModal.delete', 'Delete')}</span>
                          </button>
                        )}
                      </>
                    )}
                    {canEdit && (
                      <>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handlePdfUpload}
                          disabled={uploadStatus?.status === 'uploading'}
                          className="hidden"
                          id="pdf-upload"
                        />
                        <label
                          htmlFor="pdf-upload"
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${border.primary} ${bg.primary} cursor-pointer hover:bg-transparent transition-all shadow-sm hover:shadow-md ${
                            uploadStatus?.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {uploadStatus?.status === 'uploading' ? (
                            <>
                              <Loader className="w-5 h-5 animate-spin" />
                              <span className={text.primary}>
                                {t('employeeDetailModal.uploading', 'Uploading...')}{' '}
                                <span className={text.secondary}>
                                  ({Math.max(0, Math.min(100, Number(uploadStatus?.progress ?? 0)))}%)
                                </span>
                              </span>
                            </>
                          ) : (
                            <>
                              <Upload className={`w-5 h-5 ${text.primary}`} />
                              <span className={text.primary}>{t('employeeDetailModal.uploadPdf', 'Upload PDF')}</span>
                            </>
                          )}
                        </label>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadRequestDocs}
                      className={`px-4 py-2 text-white rounded-lg cursor-pointer flex items-center gap-2 text-sm transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-sky-700 hover:bg-sky-600' : 'bg-sky-600 hover:bg-sky-700'} ${requestDocsLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                      disabled={requestDocsLoading}
                      title={t('employeeDetailModal.requestDocsRefresh', 'Refresh')}
                      aria-label={t('employeeDetailModal.requestDocsRefresh', 'Refresh')}
                    >
                      {requestDocsLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span>{t('employeeDetailModal.requestDocsRefresh', 'Refresh')}</span>
                    </button>

                    {canUploadRequestDocs && (
                      <>
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white shadow-md ${isDarkMode ? 'bg-violet-700' : 'bg-violet-600'} border border-transparent focus-within:outline-none focus-within:ring-2 focus-within:ring-violet-400`}
                          title={t('employeeDetailModal.docCategory', 'Category')}
                          aria-label={t('employeeDetailModal.docCategory', 'Category')}
                        >
                          <ListFilter className="w-4 h-4" />
                          <select
                            value={requestDocCategory}
                            onChange={(e) => setRequestDocCategory(e.target.value)}
                            className="bg-transparent outline-none border-none pr-1 cursor-pointer"
                          >
                            <option value="leave">{t('employeeDetailModal.categoryLeave', 'Leave request')}</option>
                            <option value="other">{t('employeeDetailModal.categoryOther', 'Other')}</option>
                          </select>
                        </div>

                        <input
                          type="file"
                          onChange={handleRequestDocUpload}
                          disabled={requestDocUpload.status === 'uploading'}
                          className="hidden"
                          id="request-doc-upload"
                        />
                        <label
                          htmlFor="request-doc-upload"
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white cursor-pointer transition-all shadow-md hover:shadow-lg ${
                            requestDocUpload.status === 'uploading' ? 'opacity-60 cursor-not-allowed' : ''
                          } ${isDarkMode ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                          {requestDocUpload.status === 'uploading' ? (
                            <>
                              <Loader className="w-5 h-5 animate-spin" />
                              <span>
                                {t('employeeDetailModal.uploading', 'Uploading...')}{' '}
                                <span className={isDarkMode ? 'text-emerald-100' : 'text-emerald-100'}>({Math.max(0, Math.min(100, Number(requestDocUpload.progress ?? 0)))}%)</span>
                              </span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>{t('employeeDetailModal.uploadRequestDoc', 'Upload Document')}</span>
                            </>
                          )}
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Background Upload Indicator */}
              {documentsSubTab === 'pdf' && uploadStatus?.status === 'uploading' && (
                <div className={`mt-2 p-3 border rounded-lg ${isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                  <div className={`flex items-center space-x-2 text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>{t('employeeDetailModal.uploadBackground', '⚡ Upload continues in background - you can close this window safely')}</span>
                  </div>

                  <div className={`mt-2 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-blue-950/60' : 'bg-blue-100'}`}>
                    <div
                      className={`${isDarkMode ? 'bg-blue-400/70' : 'bg-blue-600'} h-full transition-all`}
                      style={{ width: `${Math.max(0, Math.min(100, Number(uploadStatus?.progress ?? 0)))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* PDF Viewer / Request Docs */}
              {documentsSubTab === 'pdf' ? (
                <div className={`border-2 border-dashed ${border.primary} rounded-lg p-4 min-h-100 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  {pdfUrl ? (
                    <div className="flex flex-col items-center">
                      {useIframe ? (
                        <div className="w-full" style={{ height: '600px' }}>
                          <iframe
                            src={pdfUrl}
                            type="application/pdf"
                            className="w-full h-full border-0 rounded"
                            title="PDF Viewer"
                            onLoad={() => console.log('✅ Iframe loaded successfully')}
                            onError={(e) => {
                              console.error('❌ Iframe error:', e);
                              console.error('PDF URL:', pdfUrl);
                              setPdfError('Failed to load PDF in iframe. Check console for details.');
                            }}
                          />
                        </div>
                      ) : (
                        pdfError ? (
                          <div className="flex flex-col items-center justify-center h-64 text-red-500">
                            <FileText className={`w-16 h-16 mb-4 ${isDarkMode ? 'text-white' : 'text-blue-600'}`} />
                            <p className={`text-center ${text.secondary} font-semibold`}>{pdfError}</p>
                            <button
                              onClick={() => setUseIframe(true)}
                              className={`mt-4 px-4 py-2 text-white rounded-lg transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                              {t('employeeDetailModal.switchToIframe', 'Switch to Iframe Viewer')}
                            </button>
                          </div>
                        ) : (
                          <Document
                            key={pdfUrl}
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                              <div className="flex flex-col items-center justify-center h-64">
                                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                                <p className={`mt-4 ${text.secondary}`}>Loading PDF...</p>
                              </div>
                            }
                          >
                            <Page 
                              pageNumber={pageNumber} 
                              width={Math.min(modalWidth - 100, 800)}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                            />
                          </Document>
                        )
                      )}

                      {!useIframe && !pdfError && numPages && numPages > 1 && (
                        <div className="flex items-center space-x-4 mt-4">
                          <button
                            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                            disabled={pageNumber <= 1}
                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            ←
                          </button>
                          <span className={text.primary}>
                            Page {pageNumber} of {numPages}
                          </span>
                          <button
                            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                            disabled={pageNumber >= numPages}
                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <FileText className={`w-16 h-16 mb-4 ${isDarkMode ? 'text-white' : 'text-blue-600'}`} />
                      <p className={`text-center ${text.secondary} font-semibold`}>
                        {t('employees.noPdfDocument', 'Chưa có tài liệu')}
                      </p>
                      <p className={`text-sm text-center ${text.secondary} mt-2`}>
                        {t('employees.uploadPdfPrompt', 'Tải lên tài liệu PDF để hiển thị ở đây')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`border ${border.primary} rounded-lg p-4 ${isDarkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                  {!canUploadRequestDocs && (
                    <div className={`mb-3 text-sm ${text.secondary}`}>
                      {t('employeeDetailModal.requestDocsRestricted', 'Only Admin/HR/Manager can upload request documents.')}
                    </div>
                  )}

                  {requestDocsError && (
                    <div className={`mb-3 text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                      {requestDocsError}
                    </div>
                  )}

                  {requestDocUpload.status === 'error' && requestDocUpload.error && (
                    <div className={`mb-3 text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                      {requestDocUpload.error}
                    </div>
                  )}

                  {requestDocPreview.status !== 'idle' && (
                    <div className={`mb-3 rounded-lg border ${border.primary} p-3 ${isDarkMode ? 'bg-gray-900/30' : 'bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`font-semibold truncate ${text.primary}`} title={requestDocPreview.doc?.name}>
                            {requestDocPreview.doc?.name}
                          </div>
                          <div className={`text-xs ${text.secondary}`}>
                            {requestDocPreview.doc?.category === 'leave'
                              ? t('employeeDetailModal.categoryLeave', 'Leave request')
                              : t('employeeDetailModal.categoryOther', 'Other')}
                            {requestDocPreview.doc?.sizeLabel ? ` • ${requestDocPreview.doc.sizeLabel}` : ''}
                            {requestDocPreview.doc?.dateLabel ? ` • ${requestDocPreview.doc.dateLabel}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {requestDocPreview.url && (
                            <button
                              type="button"
                              onClick={() => window.open(requestDocPreview.url, '_blank')}
                              className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 text-sm transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                              title={t('employeeDetailModal.requestDocsOpenInNewTab', 'Open in new tab')}
                              aria-label={t('employeeDetailModal.requestDocsOpenInNewTab', 'Open in new tab')}
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>{t('employeeDetailModal.requestDocsOpenInNewTab', 'Open in new tab')}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={clearRequestDocPreview}
                            className={`p-2 text-white rounded-lg transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-600 hover:bg-gray-700'}`}
                            title={t('employeeDetailModal.requestDocsClosePreview', 'Close preview')}
                            aria-label={t('employeeDetailModal.requestDocsClosePreview', 'Close preview')}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-center">
                        {requestDocPreview.status === 'loading' && (
                          <div className={`flex items-center gap-2 text-sm ${text.secondary}`}>
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>{t('employeeDetailModal.requestDocsLoading', 'Loading...')}</span>
                          </div>
                        )}

                        {requestDocPreview.status === 'error' && (
                          <div className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                            {requestDocPreview.error || t('errors.fileOpenFailed', 'Failed to open document')}
                          </div>
                        )}

                        {requestDocPreview.status === 'ready' && requestDocPreview.url && (
                          <img
                            src={requestDocPreview.url}
                            alt={requestDocPreview.doc?.name || t('employeeDetailModal.requestDocsPreview', 'Preview')}
                            className={`max-h-[60vh] w-auto rounded-md border ${border.primary} ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {formattedRequestDocs.length === 0 && !requestDocsLoading ? (
                    <div className={`flex flex-col items-center justify-center h-40 ${text.secondary}`}>
                      <FileText className={`w-10 h-10 mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-500'}`} />
                      <div className="font-semibold">{t('employeeDetailModal.noRequestDocs', 'No documents uploaded')}</div>
                      <div className="text-sm">{t('employeeDetailModal.requestDocsHint', 'Upload leave-request evidence, certificates, or other supporting files.')}</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formattedRequestDocs.map((doc) => (
                        <div
                          key={doc.path}
                          className={`flex items-center justify-between gap-3 rounded-lg border ${border.primary} px-3 py-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}
                        >
                          <div className="min-w-0">
                            <div className={`font-semibold truncate ${text.primary}`} title={doc.name}>{doc.name}</div>
                            <div className={`text-xs ${text.secondary} flex flex-wrap gap-2`}>
                              <span className={`px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-700'} border ${border.primary}`}>
                                {doc.category === 'leave'
                                  ? t('employeeDetailModal.categoryLeave', 'Leave request')
                                  : t('employeeDetailModal.categoryOther', 'Other')}
                              </span>
                              {doc.sizeLabel && <span>{doc.sizeLabel}</span>}
                              {doc.dateLabel && <span>{doc.dateLabel}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const name = doc?.originalName || doc?.name;
                                if (isPreviewableImageName(name)) {
                                  const isSameDoc = requestDocPreview?.doc?.path && requestDocPreview.doc.path === doc.path;
                                  if (requestDocPreview.status !== 'idle' && isSameDoc) {
                                    clearRequestDocPreview();
                                    return;
                                  }
                                  setRequestDocsAutoPreviewArmed(false);
                                  handleRequestDocPreview(doc);
                                  return;
                                }
                                handleRequestDocOpen(doc);
                              }}
                              className={`p-2 text-white rounded-lg transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                              title={(() => {
                                const name = doc?.originalName || doc?.name;
                                return isPreviewableImageName(name)
                                  ? t('employeeDetailModal.requestDocsPreview', 'Preview')
                                  : t('employeeDetailModal.requestDocsOpen', 'Open');
                              })()}
                              aria-label={(() => {
                                const name = doc?.originalName || doc?.name;
                                return isPreviewableImageName(name)
                                  ? t('employeeDetailModal.requestDocsPreview', 'Preview')
                                  : t('employeeDetailModal.requestDocsOpen', 'Open');
                              })()}
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {canUploadRequestDocs && (
                              <button
                                type="button"
                                onClick={() => handleRequestDocDelete(doc)}
                                className={`p-2 text-white rounded-lg transition-all shadow-md hover:shadow-lg ${isDarkMode ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-700'}`}
                                title={t('employeeDetailModal.requestDocsDelete', 'Delete')}
                                aria-label={t('employeeDetailModal.requestDocsDelete', 'Delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {requestDocsLoading && (
                    <div className={`mt-3 flex items-center gap-2 text-sm ${text.secondary}`}>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>{t('employeeDetailModal.requestDocsLoading', 'Loading...')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Info Item Component
const InfoItem = ({ icon: Icon, label, value }) => {
  const { text, border, isDarkMode } = useTheme();
  
  return (
    <div className={`flex items-start space-x-3 p-3 rounded-lg border ${border.primary} hover:bg-transparent transition-colors`}>
      <Icon className={`w-5 h-5 mt-0.5 ${isDarkMode ? text.primary : 'text-gray-600'}`} />
      <div className="flex-1">
        <p className={`text-sm ${text.secondary} mb-1`}>{label}</p>
        <p className={`font-medium ${text.primary}`}>{value}</p>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;
