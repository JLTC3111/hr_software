import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, Mail, MapPin, Award, Cake, Network, Calendar, DollarSign, User, FileText, Download, Upload, Loader, Edit2, Briefcase } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUpload } from '../contexts/UploadContext';
import { getEmployeePdfUrl } from '../services/employeeService';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const EmployeeDetailModal = ({ employee, onClose, onUpdate, onEdit }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { startPdfUpload, getUploadStatus } = useUpload();
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'contact', 'documents'
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

  const handlePdfDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
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
    if (!employee.start_date && !employee.startDate) return 'N/A';
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
    
    if (totalMonths >= 12) {
      if (months === 0) {
        return `${years} năm`;
      }
      return `${years} năm ${months} tháng`;
    }
    return `${totalMonths} tháng`;
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
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-transparent dark:hover:bg-transparent transition-colors"
        >
          <X className="w-5 h-5" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
        </button>

        {/* Header Section */}
        <div className={`${bg.primary} p-8 text-center`}>
          {/* Profile Photo */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-white dark:border-gray-600 shadow-lg">
                {employee.photo ? (
                  <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              {/* Online Status Indicator */}
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-600"></div>
            </div>
          </div>

          {/* Name & Position */}
          <h2 className={`text-2xl font-bold ${text.primary} mb-1`}>
            {employee.name}
          </h2>
          <p className={`${text.secondary} mb-4`}>
            {t(`employeePosition.${employee.position?.toLowerCase().replace(' ', '')}`, employee.position)}
          </p>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3">
            <a
              href={`mailto:${employee.email}`}
              className="p-3 bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors"
              title={t('employees.sendEmail', 'Send Email')}
            >
              <Mail className="w-5 h-5" />
            </a>
            <a
              href={`tel:${employee.phone}`}
              className="p-3 bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors"
              title={t('employees.call', 'Call')}
            >
              <Phone className="w-5 h-5" />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onEdit) {
                  onEdit(employee);
                  onClose();
                }
              }}
              className="p-3 bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors"
              title={t('employees.edit', 'Edit')}
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className={`mx-6 -mt-6 mb-4 ${bg.secondary} border ${border.primary} rounded-lg p-4 shadow-lg`}>
          <div className="flex items-center space-x-2 mb-3">
            <Briefcase className="w-5 h-5 text-blue-600 dark:text-white" />
            <h3 className={`font-semibold ${text.primary}`}>
              {t('employees.quickStats', 'Quick Stats')}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employeeDetailModal.status', 'Status')}
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full">
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
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'info'
                ? `${text.primary} border-b-2 border-blue-600`
                : `${text.secondary} hover:${text.primary}`
            }`}
          >
            <User className="w-4 h-4" />
            <span>{t('employeeDetailModal.basicInfo', 'Basic Information')}</span>
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'contact'
                ? `${text.primary} border-b-2 border-blue-600`
                : `${text.secondary} hover:${text.primary}`
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>{t('employeeDetailModal.contact', 'Contact')}</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'documents'
                ? `${text.primary} border-b-2 border-blue-600`
                : `${text.secondary} hover:${text.primary}`
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('employeeDetailModal.documents', 'Documents')}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {/* Basic Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <InfoItem icon={User} label={t('employeeDetailModal.fullName', 'Full Name')} value={employee.name} />
              <InfoItem icon={Network} label={t('employeeDetailModal.department', 'Department')} 
                value={t(`employeeDepartment.${employee.department?.toLowerCase().replace(' ', '')}`, employee.department)} />
              <InfoItem icon={Award} label={t('employeeDetailModal.position', 'Position')} 
                value={t(`employeePosition.${employee.position?.toLowerCase().replace(' ', '')}`, employee.position)} />
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
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className={`font-semibold ${text.primary}`}>
                    {t('employeeDetailModal.documentsTitle', 'Documents')}
                  </h3>
                </div>
                <div className="flex space-x-2">
                  {pdfUrl && (
                    <button
                      onClick={handlePdfDownload}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg flex items-center space-x-2 text-sm transition-all shadow-md hover:shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t('employeeDetailModal.download', 'Download')}</span>
                    </button>
                  )}
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
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${border.primary} ${bg.primary} cursor-pointer hover:bg-transparent dark:hover:bg-transparent transition-all shadow-sm hover:shadow-md ${
                      uploadStatus?.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {uploadStatus?.status === 'uploading' ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        <span className={text.primary}>{t('employeeDetailModal.uploading', 'Uploading...')}</span>
                      </>
                    ) : (
                      <>
                        <Upload className={`w-5 h-5 ${text.primary}`} />
                        <span className={text.primary}>{t('employeeDetailModal.uploadPdf', 'Upload PDF')}</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
              
              {/* Background Upload Indicator */}
              {uploadStatus?.status === 'uploading' && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>{t('employeeDetailModal.uploadBackground', '⚡ Upload continues in background - you can close this window safely')}</span>
                  </div>
                </div>
              )}

              {/* PDF Viewer Mode Toggle */}
              <div className="flex justify-end mb-2 space-x-2">
                <button
                  onClick={() => setUseIframe(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    !useIframe 
                      ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700' 
                      : `${bg.secondary} ${text.primary} border ${border.primary} hover:bg-blue-50 dark:hover:bg-gray-700`
                  }`}
                >
                  PDF.js
                </button>
                <button
                  onClick={() => setUseIframe(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    useIframe 
                      ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700' 
                      : `${bg.secondary} ${text.primary} border ${border.primary} hover:bg-blue-50 dark:hover:bg-gray-700`
                  }`}
                >
                  Iframe
                </button>
              </div>

              {/* PDF Viewer */}
              <div className={`border-2 border-dashed ${border.primary} rounded-lg p-4 bg-gray-50 dark:bg-gray-800 min-h-[400px]`}>
                {pdfUrl ? (
                  <div className="flex flex-col items-center">
                    {useIframe ? (
                      // Iframe Viewer (More reliable)
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
                      // PDF.js Viewer
                      pdfError ? (
                        <div className="flex flex-col items-center justify-center h-64 text-red-500">
                          <FileText className="w-16 h-16 mb-4" />
                          <p className={`text-center ${text.secondary} font-semibold`}>{pdfError}</p>
                          <button
                            onClick={() => setUseIframe(true)}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
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
                    <FileText className="w-16 h-16 mb-4" />
                    <p className={`text-center ${text.secondary} font-semibold`}>
                      {t('employees.noPdfDocument', 'Chưa có tài liệu')}
                    </p>
                    <p className={`text-sm text-center ${text.secondary} mt-2`}>
                      {t('employees.uploadPdfPrompt', 'Tải lên tài liệu PDF để hiển thị ở đây')}
                    </p>
                  </div>
                )}
              </div>
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
    <div className={`flex items-start space-x-3 p-3 rounded-lg border ${border.primary} hover:bg-transparent dark:hover:bg-transparent transition-colors`}>
      <Icon className={`w-5 h-5 mt-0.5 ${isDarkMode ? text.primary : 'text-blue-600'}`} />
      <div className="flex-1">
        <p className={`text-sm ${text.secondary} mb-1`}>{label}</p>
        <p className={`font-medium ${text.primary}`}>{value}</p>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;
