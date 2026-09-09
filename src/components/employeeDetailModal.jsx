import _React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Phone, Mail, MapPin, Award, Cake, Network, Calendar, DollarSign, ClipboardList, FileText, Download, Upload, Edit2, Trash2, RefreshCw, Eye, ExternalLink, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUpload } from '../contexts/UploadContext.jsx';
import { getEmployeePdfUrl, deleteEmployeePdf, uploadEmployeeRequestDocument, listEmployeeRequestDocuments, deleteEmployeeRequestDocument, getEmployeeRequestDocumentUrl } from '../services/employeeService.js';
import { getDemoEmployeeName } from '../utils/demoHelper.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { releasePdfPreviewUrl } from '../utils/pdfPreviewUrl.js';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Btn, Tag, Seg, Kicker, Bar, ColumnHeading, FlatListbox } from './ui/industry.jsx';
import { Spinner } from './ui/Spinner.jsx';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const EmployeeDetailModal = ({ employee, onClose, onUpdate, onEdit }) => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  const { user, handleSessionAuthError } = useAuth();
  const { startPdfUpload, getUploadStatus } = useUpload();
  
  // Check if user has permission to edit (not employee role)
  const canEdit = user?.role !== 'employee';
  const canUploadRequestDocs = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'contact', 'documents'
  const [documentsSubTab, setDocumentsSubTab] = useState('pdf'); // 'pdf' | 'requests'
  const [pdfPath, setPdfPath] = useState(employee?.pdf_document_url || null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfRevision, setPdfRevision] = useState(0);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [modalWidth, setModalWidth] = useState(900);
  const [isResizing, setIsResizing] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [useIframe, setUseIframe] = useState(true); // Use iframe by default
  const modalRef = useRef(null);
  const resizeRef = useRef(null);
  const pdfPreviewWindows = useRef(new Map());

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
  const pdfViewWidth = useMemo(
    () => Math.min(Math.max(modalWidth - 80, 520), 800),
    [modalWidth]
  );

  // Generate URL from file path on mount with fallback
  useEffect(() => {
    let active = true;
    let generatedUrl = null;
    const previewWindows = pdfPreviewWindows.current;
    setPdfUrl(null);
    const generatePdfUrl = async () => {
      if (!pdfPath) return;

      console.log('🔍 Generating PDF URL for path:', pdfPath);

      try {
        // Use service function to get URL
        const result = await getEmployeePdfUrl(pdfPath);
        if (!active) {
          releasePdfPreviewUrl(result.url);
          return;
        }
        
        if (result.success) {
          console.log('✅ PDF URL generated:', result.url, 'Type:', result.type);
          generatedUrl = result.url;
          setPdfUrl(result.url);
          setPdfError(null);
        } else {
          console.error('❌ Failed to get PDF URL:', result.error);
          console.error('Failed to load PDF:', result.error);
          setPdfError(t('errors.fileOpenFailed', 'Failed to open document'));
        }
      } catch (error) {
        if (!active) return;
        console.error('❌ Error generating PDF URL:', error);
        handleSessionAuthError(error, { silent: true });
        setPdfError('Failed to load PDF document');
      }
    };

    generatePdfUrl();
    return () => {
      active = false;
      releasePdfPreviewUrl(generatedUrl, previewWindows.get(generatedUrl));
      previewWindows.delete(generatedUrl);
    };
  }, [pdfPath, pdfRevision]);

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
        console.error('Failed to load request documents:', result.error);
        setRequestDocsError(t('errors.loadFailed', 'Failed to load data'));
      }
    } catch (err) {
      console.error('Failed to load request documents:', err);
      setRequestDocsError(t('errors.loadFailed', 'Failed to load data'));
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
      // Demo uploads replace the file at the same key; refresh its preview too.
      setPdfRevision((revision) => revision + 1);
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
    globalThis.addEventListener('keydown', handleEsc);
    return () => globalThis.removeEventListener('keydown', handleEsc);
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
      globalThis.addEventListener('mousemove', handleMouseMove, { capture: true, passive: false });
      globalThis.addEventListener('mouseup', handleMouseUp, { capture: true, passive: false });
    }

    return () => {
      globalThis.removeEventListener('mousemove', handleMouseMove, { capture: true });
      globalThis.removeEventListener('mouseup', handleMouseUp, { capture: true });
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
        console.error('Failed to upload PDF:', result.error);
        alert(t('errors.uploadFailed', 'Failed to upload PDF'));
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
      console.error('Request document upload failed:', err);
      setRequestDocUpload({ status: 'error', progress: 0, error: t('errors.uploadFailed', 'Failed to upload file') });
      alert(t('errors.uploadFailed', 'Failed to upload file'));
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
      globalThis.open(result.url, '_blank');
    } catch (err) {
      console.error('Failed to open request document:', err);
      alert(t('errors.fileOpenFailed', 'Failed to open document'));
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
      console.error('Failed to preview request document:', err);
      setRequestDocPreview({ status: 'error', doc, url: null, error: t('errors.fileOpenFailed', 'Failed to open document') });
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
    const confirmDelete = globalThis.confirm(
      t('employeeDetailModal.confirmDelete', 'Are you sure you want to delete this document?')
    );
    if (!confirmDelete) return;

    try {
      const result = await deleteEmployeeRequestDocument(employee.id, doc.path);
      if (!result.success) throw new Error(result.error || 'Delete failed');
      await loadRequestDocs();
      alert(t('employeeDetailModal.documentDeleted', 'Document deleted successfully'));
    } catch (err) {
      console.error('Failed to delete request document:', err);
      alert(t('employeeDetailModal.documentDeleteError', 'Failed to delete document'));
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
      const preview = globalThis.open(pdfUrl, '_blank');
      if (preview && pdfUrl.startsWith('blob:')) {
        const windows = pdfPreviewWindows.current.get(pdfUrl) || [];
        windows.push(preview);
        pdfPreviewWindows.current.set(pdfUrl, windows);
      }
    }
  };

  const handlePdfDelete = async () => {
    if (!pdfPath) return;

    const confirmDelete = globalThis.confirm(
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
        console.error('Failed to delete PDF:', result.error);
        alert(t('errors.deleteFailed', 'Failed to delete PDF'));
      }
    } catch (error) {
      console.error('❌ Error deleting PDF:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('errors.deleteFailed', 'Failed to delete PDF'));
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

  if (!employee) return null;

  const displayName = getDemoEmployeeName(employee, t);
  const statusKey = String(employee.status || 'Active').toLowerCase().replace(/\s+/g, '');
  const statusVariant = statusKey === 'inactive' ? 'outline' : statusKey === 'onleave' ? 'neutral' : 'accent';
  const iconBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    background: 'transparent',
    border: `1px solid ${ind.hairline}`,
    borderRadius: 0,
    color: ind.ink,
    cursor: 'pointer',
  };
  const labelBtn = (solid) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    padding: '4px 12px',
    borderRadius: 0,
    cursor: 'pointer',
    background: solid ? ind.accent : 'transparent',
    color: solid ? ind.accentInk : ind.ink,
    border: `1px solid ${solid ? ind.accent : ind.hairline}`,
  });
  const note = { fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: 0, lineHeight: 1.5 };
  const alertNote = {
    fontFamily: BODY, fontSize: 12.5, color: ind.ink, margin: '0 0 10px',
    borderLeft: `2px solid ${ind.ink}`, paddingLeft: 8, lineHeight: 1.5,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,31,32,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={(e) => {
        if (!isResizing && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{ width: `${modalWidth}px`, maxWidth: '100%', maxHeight: '90vh', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
      <Blueprint
        ind={ind}
        style={{
          background: ind.ground, height: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          color: ind.ink, fontFamily: BODY, overflow: 'hidden',
        }}
      >
        <div
          ref={resizeRef}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 50 }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => { e.currentTarget.style.background = ind.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />

        <div
          className="flex items-start justify-between"
          style={{ gap: 16, padding: '18px 20px 16px', borderBottom: `1px solid ${ind.hairline}` }}
        >
          <div className="flex items-start" style={{ gap: 14, minWidth: 0 }}>
            <Portrait ind={ind} employee={employee} name={displayName} />
            <div style={{ minWidth: 0 }}>
              <ColumnHeading ind={ind} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </ColumnHeading>
              <p style={{ ...note, marginTop: 4 }}>
                {t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)}
              </p>
              <div style={{ marginTop: 8 }}>
                <Tag ind={ind} variant={statusVariant}>
                  {t(`employeeStatus.${statusKey}`, employee.status)}
                </Tag>
              </div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8, flex: 'none' }}>
            <a href={`mailto:${employee.email}`} title={t('employees.sendEmail', 'Send Email')} style={iconBtn}>
              <Mail size={15} strokeWidth={1.5} />
            </a>
            <a href={`tel:${employee.phone}`} title={t('employees.call', 'Call')} style={iconBtn}>
              <Phone size={15} strokeWidth={1.5} />
            </a>
            {canEdit && (
              <button
                type="button"
                title={t('employees.edit', 'Edit')}
                style={iconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) {
                    onEdit(employee);
                    onClose();
                  }
                }}
              >
                <Edit2 size={15} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div
          className="grid grid-cols-3"
          style={{ gap: 0, borderBottom: `1px solid ${ind.hairline}` }}
        >
          {[
            [t('employeeDetailModal.status', 'Status'), (
              <Tag ind={ind} variant={statusVariant}>
                {t(`employeeStatus.${statusKey}`, employee.status)}
              </Tag>
            )],
            [t('employeeDetailModal.workDuration', 'Work Duration'), (
              <span style={figure(16, ind.ink)}>{calculateWorkDuration()}</span>
            )],
            [t('employeeDetailModal.performance', 'Performance'), (
              <span style={figure(16, ind.ink)}>{employee.performance != null ? `${employee.performance}/5.0` : '—'}</span>
            )],
          ].map(([label, value], i) => (
            <div
              key={label}
              style={{
                padding: '12px 20px',
                borderRight: i < 2 ? `1px solid ${ind.rule}` : 'none',
              }}
            >
              <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
              <div style={{ marginTop: 6 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <Seg
            ind={ind}
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel={t('employeeDetailModal.basicInfo', 'Basic Information')}
            options={[
              { value: 'info', label: t('employeeDetailModal.basicInfo', 'Basic Information') },
              { value: 'contact', label: t('employeeDetailModal.contact', 'Contact') },
              { value: 'documents', label: t('employeeDetailModal.documents', 'Documents') },
            ]}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
          {activeTab === 'info' && (
            <div>
              <InfoItem ind={ind} icon={ClipboardList} label={t('employeeDetailModal.fullName', 'Full Name')} value={displayName} />
              <InfoItem
                ind={ind}
                icon={Network}
                label={t('employeeDetailModal.department', 'Department')}
                value={t(`employeeDepartment.${employee.department?.toLowerCase().replace(' ', '')}`, employee.department)}
              />
              <InfoItem
                ind={ind}
                icon={Award}
                label={t('employeeDetailModal.position', 'Position')}
                value={t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)}
              />
              <InfoItem ind={ind} icon={Cake} label={t('employeeDetailModal.dateOfBirth', 'Date of Birth')} value={employee.dob} />
              <InfoItem ind={ind} icon={Calendar} label={t('employeeDetailModal.startDate', 'Start Date')} value={employee.start_date || employee.startDate || 'N/A'} />
              <InfoItem ind={ind} icon={DollarSign} label={t('employeeDetailModal.salary', 'Salary')} value={employee.salary != null ? `$${employee.salary.toLocaleString()}` : 'N/A'} />
            </div>
          )}

          {activeTab === 'contact' && (
            <div>
              <InfoItem ind={ind} icon={Mail} label={t('employeeDetailModal.email', 'Email')} value={employee.email} />
              <InfoItem ind={ind} icon={Phone} label={t('employeeDetailModal.phone', 'Phone Number')} value={employee.phone} />
              <InfoItem ind={ind} icon={MapPin} label={t('employeeDetailModal.address', 'Address')} value={employee.address || 'N/A'} />
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              <div className="flex flex-wrap items-center justify-between" style={{ gap: 10, margin: '12px 0' }}>
                <Seg
                  ind={ind}
                  value={documentsSubTab}
                  onChange={setDocumentsSubTab}
                  ariaLabel={t('employeeDetailModal.pdfTab', 'PDF')}
                  options={[
                    { value: 'pdf', label: t('employeeDetailModal.pdfTab', 'PDF') },
                    { value: 'requests', label: t('employeeDetailModal.requestDocsTab', 'Requests') },
                  ]}
                />

                {documentsSubTab === 'pdf' ? (
                  <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                    {pdfUrl && (
                      <>
                        <Btn ind={ind} onClick={handlePdfDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Download size={13} strokeWidth={1.5} />
                          {t('employeeDetailModal.download', 'Download')}
                        </Btn>
                        {canEdit && (
                          <Btn ind={ind} onClick={handlePdfDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: ind.ink }}>
                            <Trash2 size={13} strokeWidth={1.5} />
                            {t('employeeDetailModal.delete', 'Delete')}
                          </Btn>
                        )}
                      </>
                    )}
                    {canEdit && (
                      <>
                        <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={uploadStatus?.status === 'uploading'} className="hidden" id="pdf-upload" />
                        <label htmlFor="pdf-upload" style={{ ...labelBtn(false), opacity: uploadStatus?.status === 'uploading' ? 0.5 : 1 }}>
                          <Upload size={13} strokeWidth={1.5} />
                          {uploadStatus?.status === 'uploading'
                            ? `${t('employeeDetailModal.uploading', 'Uploading...')} (${Math.max(0, Math.min(100, Number(uploadStatus?.progress ?? 0)))}%)`
                            : t('employeeDetailModal.uploadPdf', 'Upload PDF')}
                        </label>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                    <Btn
                      ind={ind}
                      onClick={loadRequestDocs}
                      disabled={requestDocsLoading}
                      title={t('employeeDetailModal.requestDocsRefresh', 'Refresh')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <RefreshCw size={13} strokeWidth={1.5} />
                      {t('employeeDetailModal.requestDocsRefresh', 'Refresh')}
                    </Btn>
                    {canUploadRequestDocs && (
                      <>
                        <FlatListbox
                          ind={ind}
                          value={requestDocCategory}
                          onChange={(e) => setRequestDocCategory(e.target.value)}
                          aria-label={t('employeeDetailModal.docCategory', 'Category')}
                          style={{ width: 180, padding: '4px 8px', textTransform: 'none', letterSpacing: '.02em' }}
                        >
                          <option value="leave">{t('employeeDetailModal.categoryLeave', 'Leave request')}</option>
                          <option value="other">{t('employeeDetailModal.categoryOther', 'Other')}</option>
                        </FlatListbox>
                        <input type="file" onChange={handleRequestDocUpload} disabled={requestDocUpload.status === 'uploading'} className="hidden" id="request-doc-upload" />
                        <label htmlFor="request-doc-upload" style={{ ...labelBtn(true), opacity: requestDocUpload.status === 'uploading' ? 0.6 : 1 }}>
                          <Upload size={13} strokeWidth={1.5} />
                          {requestDocUpload.status === 'uploading'
                            ? `${t('employeeDetailModal.uploading', 'Uploading...')} (${Math.max(0, Math.min(100, Number(requestDocUpload.progress ?? 0)))}%)`
                            : t('employeeDetailModal.uploadRequestDoc', 'Upload Document')}
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>

              {documentsSubTab === 'pdf' && uploadStatus?.status === 'uploading' && (
                <div style={{ border: `1px solid ${ind.hairline}`, padding: 12, marginBottom: 12 }}>
                  <p style={{ ...note, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Zap size={14} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.inkMuted }} aria-hidden="true" />
                    {t('employeeDetailModal.uploadBackground', 'Upload continues in background - you can close this window safely')}
                  </p>
                  <div style={{ marginTop: 8 }}>
                    <Bar ind={ind} value={Math.max(0, Math.min(100, Number(uploadStatus?.progress ?? 0))) / 100} fill={ind.accent} height={7} />
                  </div>
                </div>
              )}

              {documentsSubTab === 'pdf' ? (
                <div style={{ border: `1px solid ${ind.hairline}`, padding: 12, minHeight: 240 }}>
                  {pdfUrl ? (
                    <div className="flex flex-col items-center w-full">
                      <div className="pdf-viewer-frame w-full flex justify-center overflow-x-hidden" style={{ maxWidth: pdfViewWidth }}>
                        {useIframe ? (
                          <iframe
                            src={`${pdfUrl}#view=FitH&toolbar=0&navpanes=0`}
                            type="application/pdf"
                            className="border-0 block mx-auto shrink-0"
                            style={{ width: pdfViewWidth, height: 600, borderRadius: 0 }}
                            title={t('employeeDetailModal.pdfViewerTitle', 'PDF Viewer')}
                            onLoad={() => console.log('✅ Iframe loaded successfully')}
                            onError={(e) => {
                              console.error('❌ Iframe error:', e);
                              setPdfError(t('errors.fileOpenFailed', 'Failed to open document'));
                            }}
                          />
                        ) : pdfError ? (
                          <div className="flex flex-col items-center justify-center" style={{ height: 256, gap: 10 }}>
                            <FileText size={28} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
                            <p style={{ ...note, textAlign: 'center' }}>{pdfError}</p>
                            <Btn ind={ind} variant="primary" onClick={() => setUseIframe(true)}>
                              {t('employeeDetailModal.switchToIframe', 'Switch to Iframe Viewer')}
                            </Btn>
                          </div>
                        ) : (
                          <div className="pdf-viewer-canvas flex justify-center overflow-x-hidden overflow-y-auto" style={{ width: pdfViewWidth, minHeight: 600 }}>
                            <Document
                              key={pdfUrl}
                              file={pdfUrl}
                              onLoadSuccess={onDocumentLoadSuccess}
                              onLoadError={onDocumentLoadError}
                              loading={
                                <div className="flex flex-col items-center justify-center" style={{ width: pdfViewWidth, height: 600 }}>
                                  <Spinner ind={ind} size="block" label={t('employeeDetailModal.loadingPdf', 'Loading PDF...')} />
                                </div>
                              }
                            >
                              <Page
                                pageNumber={pageNumber}
                                width={pdfViewWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="mx-auto"
                              />
                            </Document>
                          </div>
                        )}
                      </div>

                      {!useIframe && !pdfError && numPages && numPages > 1 && (
                        <div className="flex items-center" style={{ gap: 12, marginTop: 12 }}>
                          <Btn ind={ind} onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1}>←</Btn>
                          <span style={{ fontFamily: BODY, fontSize: 13, color: ind.ink }}>
                            {t('reports.page', 'Page')} {pageNumber} {t('reports.of', 'of')} {numPages}
                          </span>
                          <Btn ind={ind} onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))} disabled={pageNumber >= numPages}>→</Btn>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center" style={{ height: 256, gap: 8 }}>
                      <FileText size={28} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
                      <p style={{ ...note, textAlign: 'center', color: ind.ink }}>{t('employees.noPdfDocument', 'No document yet')}</p>
                      <p style={{ ...note, textAlign: 'center' }}>{t('employees.uploadPdfPrompt', 'Upload a PDF document to display it here')}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ border: `1px solid ${ind.hairline}`, padding: 12 }}>
                  {!canUploadRequestDocs && (
                    <p style={{ ...note, marginBottom: 10 }}>{t('employeeDetailModal.requestDocsRestricted', 'Only Admin/HR/Manager can upload request documents.')}</p>
                  )}
                  {requestDocsError && <p style={alertNote}>{requestDocsError}</p>}
                  {requestDocUpload.status === 'error' && requestDocUpload.error && <p style={alertNote}>{requestDocUpload.error}</p>}

                  {requestDocPreview.status !== 'idle' && (
                    <div style={{ border: `1px solid ${ind.hairline}`, padding: 12, marginBottom: 12 }}>
                      <div className="flex items-start justify-between" style={{ gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={requestDocPreview.doc?.name}>
                            {requestDocPreview.doc?.name}
                          </div>
                          <div style={{ ...note, marginTop: 4 }}>
                            {requestDocPreview.doc?.category === 'leave'
                              ? t('employeeDetailModal.categoryLeave', 'Leave request')
                              : t('employeeDetailModal.categoryOther', 'Other')}
                            {requestDocPreview.doc?.sizeLabel ? ` · ${requestDocPreview.doc.sizeLabel}` : ''}
                            {requestDocPreview.doc?.dateLabel ? ` · ${requestDocPreview.doc.dateLabel}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center" style={{ gap: 8, flex: 'none' }}>
                          {requestDocPreview.url && (
                            <Btn
                              ind={ind}
                              onClick={() => globalThis.open(requestDocPreview.url, '_blank')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <ExternalLink size={13} strokeWidth={1.5} />
                              {t('employeeDetailModal.requestDocsOpenInNewTab', 'Open in new tab')}
                            </Btn>
                          )}
                          <button type="button" onClick={clearRequestDocPreview} aria-label={t('employeeDetailModal.requestDocsClosePreview', 'Close preview')} style={iconBtn}>
                            <X size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-center" style={{ marginTop: 12 }}>
                        {requestDocPreview.status === 'loading' && (
                          <Spinner ind={ind} size="inline" label={t('employeeDetailModal.requestDocsLoading', 'Loading...')} />
                        )}
                        {requestDocPreview.status === 'error' && (
                          <p style={alertNote}>{requestDocPreview.error || t('errors.fileOpenFailed', 'Failed to open document')}</p>
                        )}
                        {requestDocPreview.status === 'ready' && requestDocPreview.url && (
                          <img
                            src={requestDocPreview.url}
                            alt={requestDocPreview.doc?.name || t('employeeDetailModal.requestDocsPreview', 'Preview')}
                            style={{ maxHeight: '60vh', width: 'auto', border: `1px solid ${ind.hairline}`, borderRadius: 0, background: ind.ground }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {formattedRequestDocs.length === 0 && !requestDocsLoading ? (
                    <div className="flex flex-col items-center justify-center" style={{ height: 160, gap: 6 }}>
                      <FileText size={22} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink }}>
                        {t('employeeDetailModal.noRequestDocs', 'No documents uploaded')}
                      </div>
                      <div style={{ ...note, textAlign: 'center' }}>{t('employeeDetailModal.requestDocsHint', 'Upload leave-request evidence, certificates, or other supporting files.')}</div>
                    </div>
                  ) : (
                    <div>
                      {formattedRequestDocs.map((doc) => {
                        const name = doc?.originalName || doc?.name;
                        const previewable = isPreviewableImageName(name);
                        const isSameDoc = requestDocPreview?.doc?.path && requestDocPreview.doc.path === doc.path;
                        return (
                          <div
                            key={doc.path}
                            className="flex items-center justify-between"
                            style={{ gap: 12, padding: '10px 0', borderTop: `1px solid ${ind.rule}` }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>
                                {doc.name}
                              </div>
                              <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 4 }}>
                                <Tag ind={ind} variant={doc.category === 'leave' ? 'accent' : 'neutral'}>
                                  {doc.category === 'leave'
                                    ? t('employeeDetailModal.categoryLeave', 'Leave request')
                                    : t('employeeDetailModal.categoryOther', 'Other')}
                                </Tag>
                                {doc.sizeLabel && <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>{doc.sizeLabel}</span>}
                                {doc.dateLabel && <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>{doc.dateLabel}</span>}
                              </div>
                            </div>
                            <div className="flex items-center" style={{ gap: 6, flex: 'none' }}>
                              <button
                                type="button"
                                style={iconBtn}
                                title={previewable ? t('employeeDetailModal.requestDocsPreview', 'Preview') : t('employeeDetailModal.requestDocsOpen', 'Open')}
                                aria-label={previewable ? t('employeeDetailModal.requestDocsPreview', 'Preview') : t('employeeDetailModal.requestDocsOpen', 'Open')}
                                onClick={() => {
                                  if (previewable) {
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
                              >
                                <Eye size={15} strokeWidth={1.5} />
                              </button>
                              {canUploadRequestDocs && (
                                <button
                                  type="button"
                                  style={iconBtn}
                                  title={t('employeeDetailModal.requestDocsDelete', 'Delete')}
                                  aria-label={t('employeeDetailModal.requestDocsDelete', 'Delete')}
                                  onClick={() => handleRequestDocDelete(doc)}
                                >
                                  <Trash2 size={15} strokeWidth={1.5} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {requestDocsLoading && (
                    <div style={{ marginTop: 12 }}>
                      <Spinner ind={ind} size="inline" label={t('employeeDetailModal.requestDocsLoading', 'Loading...')} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Blueprint>
      </div>
    </div>
  );
};

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function Portrait({ ind, employee, name }) {
  const [failed, setFailed] = useState(false);
  const photo = !failed ? employee?.photo : null;
  return (
    <div
      style={{
        width: 72, height: 72, flex: 'none',
        border: `1px solid ${ind.hairline}`,
        background: photo ? 'transparent' : ind.accentWash,
        display: 'grid', placeItems: 'center', overflow: 'hidden',
      }}
    >
      {photo ? (
        <img src={photo} alt={name} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, letterSpacing: '.04em', color: ind.accentDeep }}>
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}

function InfoItem({ ind, icon, label, value }) {
  return (
    <div className="flex items-start" style={{ gap: 10, padding: '10px 0', borderBottom: `1px solid ${ind.rule}` }}>
      {_React.createElement(icon, { size: 15, strokeWidth: 1.5, style: { color: ind.inkMuted, marginTop: 2, flex: 'none' } })}
      <div style={{ minWidth: 0, flex: 1 }}>
        <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
        <div style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, marginTop: 4 }}>{value || 'N/A'}</div>
      </div>
    </div>
  );
}

export default EmployeeDetailModal;
