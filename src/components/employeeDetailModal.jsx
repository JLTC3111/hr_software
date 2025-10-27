import React, { useState } from 'react';
import { X, Phone, Mail, MapPin, Award, Cake, Network, Calendar, DollarSign, User, FileText, Download, Upload, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../config/supabaseClient';

const EmployeeDetailModal = ({ employee, onClose, onUpdate }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(employee?.pdf_document_url || null);

  if (!employee) return null;

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate PDF file
    if (file.type !== 'application/pdf') {
      alert(t('errors.invalidFileType', 'Please select a PDF file'));
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = 'pdf';
      const fileName = `${employee.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Check if bucket exists, if not create it
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === 'employee-documents');
      
      if (!bucketExists) {
        const { error: createError } = await supabase.storage.createBucket('employee-documents', {
          public: false,
          fileSizeLimit: null
        });
        if (createError && !createError.message.includes('already exists')) {
          throw new Error('Please ask your administrator to create the employee-documents storage bucket');
        }
      }

      // Delete old file if exists
      if (pdfUrl) {
        const oldPath = pdfUrl.split('/').pop();
        await supabase.storage
          .from('employee-documents')
          .remove([oldPath]);
      }

      // Upload new file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(filePath);

      // Update employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({ pdf_document_url: publicUrl })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      setPdfUrl(publicUrl);
      if (onUpdate) onUpdate();
      alert(t('success.pdfUploaded', 'PDF document uploaded successfully!'));
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert(t('errors.uploadFailed', 'Failed to upload PDF document'));
    } finally {
      setUploading(false);
    }
  };

  const handlePdfDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className={`${bg.secondary} rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col`}
        style={{ maxWidth: '88rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${border.primary}`}>
          <h2 className={`text-2xl font-bold ${text.primary}`}>
            {t('employees.employeeDetails', 'Employee Details')}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
          >
            <X className="w-6 h-6" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Employee Info */}
            <div className="space-y-4">
              {/* Photo */}
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  {employee.photo ? (
                    <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
                <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>
                  {t('employees.basicInfo', 'Basic Information')}
                </h3>
                <div className="space-y-3">
                  <InfoRow icon={User} label={t('employees.name', 'Name')} value={employee.name} />
                  <InfoRow icon={Network} label={t('employees.department', 'Department')} 
                    value={t(`employeeDepartment.${employee.department?.toLowerCase().replace(' ', '')}`, employee.department)} />
                  <InfoRow icon={Award} label={t('employees.position', 'Position')} 
                    value={t(`employeePosition.${employee.position?.toLowerCase().replace(' ', '')}`, employee.position)} />
                  <InfoRow icon={Cake} label={t('employees.dob', 'Date of Birth')} value={employee.dob} />
                  <InfoRow icon={Calendar} label={t('employees.startDate', 'Start Date')} value={employee.start_date || employee.startDate || 'N/A'} />
                </div>
              </div>

              {/* Contact Info */}
              <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
                <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>
                  {t('employees.contactInfo', 'Contact Information')}
                </h3>
                <div className="space-y-3">
                  <InfoRow icon={Mail} label={t('employees.email', 'Email')} value={employee.email} />
                  <InfoRow icon={Phone} label={t('employees.phone', 'Phone')} value={employee.phone} />
                  <InfoRow icon={MapPin} label={t('employees.address', 'Address')} value={employee.address || 'N/A'} />
                </div>
              </div>

              {/* Performance & Salary */}
              <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
                <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>
                  {t('employees.performanceSalary', 'Performance & Salary')}
                </h3>
                <div className="space-y-3">
                  <InfoRow icon={Award} label={t('employees.performance', 'Performance')} value={`${employee.performance}/5.0`} />
                  <InfoRow icon={DollarSign} label={t('employees.salary', 'Salary')} value={`$${employee.salary?.toLocaleString() || 'N/A'}`} />
                </div>
              </div>
            </div>

            {/* Right Column - PDF Viewer */}
            <div className="space-y-4">
              <div className={`${bg.primary} rounded-lg p-4 border ${border.primary} h-full flex flex-col`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-semibold ${text.primary}`}>
                    {t('employees.documents', 'Documents')}
                  </h3>
                  <div className="flex space-x-2">
                    {pdfUrl && (
                      <button
                        onClick={handlePdfDownload}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm"
                        title={t('employees.downloadPdf', 'Download PDF')}
                      >
                        <Download className="w-4 h-4" />
                        <span>{t('common.download', 'Download')}</span>
                      </button>
                    )}
                    <label className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 cursor-pointer text-sm">
                      {uploading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>{t('common.uploading', 'Uploading...')}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>{t('common.upload', 'Upload')}</span>
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
                <div className="flex-1 min-h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden" style={{ width: '75vw' }}>
                  {pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full"
                      title={`${employee.name} - Document`}
                      style={{ border: 'none' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <FileText className="w-16 h-16 mb-4" />
                      <p className={`text-center ${text.secondary}`}>
                        {t('employees.noPdfDocument', 'No PDF document uploaded yet')}
                      </p>
                      <p className={`text-sm text-center ${text.secondary} mt-2`}>
                        {t('employees.uploadPdfPrompt', 'Click Upload to add a document')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end p-6 border-t ${border.primary}`}>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper component for info rows
const InfoRow = ({ icon: Icon, label, value }) => {
  const { text, isDarkMode } = useTheme();
  
  return (
    <div className="flex items-start space-x-3">
      <Icon className="w-5 h-5 mt-0.5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
      <div className="flex-1">
        <p className={`text-sm ${text.secondary}`}>{label}</p>
        <p className={`font-medium ${text.primary}`}>{value}</p>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;
