import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, Mail, MapPin, Award, Cake, Network, Calendar, DollarSign, User, FileText, Download, Upload, Loader, Edit2, Briefcase, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../config/supabaseClient';
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const EmployeeDetailModal = ({ employee, onClose, onUpdate, onEdit }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'contact', 'documents'
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(employee?.pdf_document_url || null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [modalWidth, setModalWidth] = useState(900);
  const [isResizing, setIsResizing] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const modalRef = useRef(null);
  const resizeRef = useRef(null);

  if (!employee) return null;

  // Fetch signed URL for existing PDF on mount
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (pdfUrl && pdfUrl.includes('employee-documents')) {
        try {
          // Extract filename from URL
          const urlParts = pdfUrl.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
          
          // Get signed URL
          const { data, error } = await supabase.storage
            .from('employee-documents')
            .createSignedUrl(fileName, 31536000); // 1 year
          
          if (!error && data?.signedUrl) {
            setPdfUrl(data.signedUrl);
          }
        } catch (error) {
          console.error('Error fetching signed URL:', error);
        }
      }
    };
    
    fetchSignedUrl();
  }, [employee?.id]);

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
      e.stopPropagation();
      const newWidth = e.clientX - modalRef.current.getBoundingClientRect().left;
      if (newWidth >= 600 && newWidth <= 1400) {
        setModalWidth(newWidth);
      }
    };

    const handleMouseUp = (e) => {
      if (isResizing) {
        e.stopPropagation();
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, true);
      window.addEventListener('mouseup', handleMouseUp, true);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [isResizing]);

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert(t('errors.invalidFileType', 'Please select a PDF file'));
      return;
    }

    setUploading(true);
    try {
      const fileName = `${employee.id}_${Date.now()}.pdf`;
      const filePath = fileName;

      // Delete old file if exists
      if (pdfUrl) {
        const oldPath = pdfUrl.split('/').pop();
        await supabase.storage
          .from('employee-documents')
          .remove([oldPath]);
      }

      // Upload new file with upsert: false to avoid conflicts
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get signed URL (valid for 1 year)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('employee-documents')
        .createSignedUrl(filePath, 31536000); // 1 year in seconds

      if (urlError) throw urlError;

      const signedUrl = signedUrlData.signedUrl;

      // Update employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({ pdf_document_url: signedUrl })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      setPdfUrl(signedUrl);
      setPageNumber(1);
      setNumPages(null);
      setPdfError(null);
      if (onUpdate) onUpdate();
      alert(t('success.pdfUploaded', 'PDF document uploaded successfully!'));
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert(t('errors.uploadFailed', `Failed to upload PDF document: ${error.message}`));
    } finally {
      setUploading(false);
    }
  };

  const handlePdfDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPdfLoading(false);
    setPdfError(null);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error);
    setPdfError('Failed to load PDF. The file may be corrupted or inaccessible.');
    setPdfLoading(false);
  };

  // Calculate work duration
  const calculateWorkDuration = () => {
    if (!employee.start_date && !employee.startDate) return 'N/A';
    const startDate = new Date(employee.start_date || employee.startDate);
    const now = new Date();
    const years = now.getFullYear() - startDate.getFullYear();
    const months = now.getMonth() - startDate.getMonth();
    const totalMonths = years * 12 + months;
    return totalMonths >= 12 ? `${years}.${months} năm` : `${totalMonths} tháng`;
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
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
              className="p-3 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
              title={t('employees.sendEmail', 'Send Email')}
            >
              <Mail className="w-5 h-5" />
            </a>
            <a
              href={`tel:${employee.phone}`}
              className="p-3 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
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
              className="p-3 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
              title={t('employees.edit', 'Edit')}
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className={`mx-6 -mt-6 mb-4 ${bg.secondary} border ${border.primary} rounded-lg p-4 shadow-lg`}>
          <div className="flex items-center space-x-2 mb-3">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <h3 className={`font-semibold ${text.primary}`}>
              {t('employees.quickStats', 'Thông kê nhanh')}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employees.status', 'Trạng thái')}
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full">
                {t(`employeeStatus.${employee.status.toLowerCase().replace(' ', '')}`, employee.status)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employees.workDuration', 'Thời gian làm việc')}
              </span>
              <span className={`text-sm font-semibold ${text.primary}`}>
                {calculateWorkDuration()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${text.secondary}`}>
                {t('employees.performance', 'Hiệu suất')}
              </span>
              <span className="text-sm font-semibold text-yellow-600 flex items-center">
                {employee.performance}/5.0 ⭐
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
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
            <span>{t('employees.basicInfo', 'Thông tin cơ bản')}</span>
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
            <span>{t('employees.contact', 'Liên hệ')}</span>
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
            <span>{t('employees.documents', 'Tài liệu')}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Basic Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <InfoItem icon={User} label={t('employees.fullName', 'Họ và tên')} value={employee.name} />
              <InfoItem icon={Network} label={t('employees.department', 'Phòng ban')} 
                value={t(`employeeDepartment.${employee.department?.toLowerCase().replace(' ', '')}`, employee.department)} />
              <InfoItem icon={Award} label={t('employees.position', 'Chức vụ')} 
                value={t(`employeePosition.${employee.position?.toLowerCase().replace(' ', '')}`, employee.position)} />
              <InfoItem icon={Cake} label={t('employees.dob', 'Ngày sinh')} value={employee.dob} />
              <InfoItem icon={Calendar} label={t('employees.startDate', 'Ngày vào làm')} 
                value={employee.start_date || employee.startDate || 'N/A'} />
              <InfoItem icon={DollarSign} label={t('employees.salary', 'Lương')} 
                value={`$${employee.salary?.toLocaleString() || 'N/A'}`} />
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <InfoItem icon={Mail} label={t('employees.email', 'Email')} value={employee.email} />
              <InfoItem icon={Phone} label={t('employees.phone', 'Số điện thoại')} value={employee.phone} />
              <InfoItem icon={MapPin} label={t('employees.address', 'Địa chỉ')} value={employee.address || 'N/A'} />
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className={`font-semibold ${text.primary}`}>
                    {t('employees.documents', 'Tài liệu')}
                  </h3>
                </div>
                <div className="flex space-x-2">
                  {pdfUrl && (
                    <button
                      onClick={handlePdfDownload}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t('common.download', 'Tải xuống')}</span>
                    </button>
                  )}
                  <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 cursor-pointer text-sm">
                    {uploading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>{t('common.uploading', 'Đang tải...')}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>{t('common.upload', 'Tải lên')}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className={`border-2 border-dashed ${border.primary} rounded-lg p-4 bg-gray-50 dark:bg-gray-800 min-h-[400px]`}>
                {pdfUrl ? (
                  <div className="flex flex-col items-center">
                    {pdfError ? (
                      <div className="flex flex-col items-center justify-center h-64 text-red-500">
                        <FileText className="w-16 h-16 mb-4" />
                        <p className={`text-center ${text.secondary} font-semibold`}>{pdfError}</p>
                        <button
                          onClick={() => {
                            setPdfError(null);
                            setPdfLoading(true);
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <Document
                        key={pdfUrl}
                        file={{
                          url: pdfUrl,
                          httpHeaders: {},
                          withCredentials: false
                        }}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                          <div className="flex flex-col items-center justify-center h-64">
                            <Loader className="w-8 h-8 animate-spin text-blue-600" />
                            <p className={`mt-4 ${text.secondary}`}>Loading PDF...</p>
                          </div>
                        }
                        options={{
                          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                          cMapPacked: true,
                          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
                        }}
                      >
                      <Page 
                        pageNumber={pageNumber} 
                        width={Math.min(modalWidth - 100, 800)}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                      />
                      </Document>
                    )}
                    {!pdfError && numPages && numPages > 1 && (
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
    <div className={`flex items-start space-x-3 p-3 rounded-lg border ${border.primary} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}>
      <Icon className="w-5 h-5 mt-0.5 text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <p className={`text-sm ${text.secondary} mb-1`}>{label}</p>
        <p className={`font-medium ${text.primary}`}>{value}</p>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;
