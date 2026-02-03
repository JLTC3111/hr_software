import _React, { createContext, useContext, useState, useCallback } from 'react';
import { uploadEmployeePdf } from '../services/employeeService.js';

const UploadContext = createContext();

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within UploadProvider');
  }
  return context;
};

export const UploadProvider = ({ children }) => {
  const [uploads, setUploads] = useState({});
  
  const startPdfUpload = useCallback((file, employeeId, onComplete) => {
    console.log('🚀 Starting background PDF upload for employee:', employeeId);

    // Initialize upload state
    setUploads(prev => ({
      ...prev,
      [employeeId]: {
        status: 'uploading',
        progress: 0,
        error: null,
        result: null,
        fileName: file.name
      }
    }));

    // Start the upload (this continues even if component unmounts)
    uploadEmployeePdf(file, employeeId, (progress) => {
      setUploads(prev => {
        const existing = prev[employeeId];
        if (!existing) return prev;
        return {
          ...prev,
          [employeeId]: {
            ...existing,
            progress: progress ?? existing.progress
          }
        };
      });
    })
      .then(result => {
        console.log('✅ Background upload completed for employee:', employeeId, result);
        
        setUploads(prev => ({
          ...prev,
          [employeeId]: {
            status: result.success ? 'completed' : 'error',
            progress: 100,
            error: result.success ? null : result.error,
            result: result.success ? result : null,
            fileName: file.name
          }
        }));

        // Call completion callback if provided
        if (onComplete) {
          onComplete(result);
        }

        // Auto-clear completed uploads after 10 seconds
        setTimeout(() => {
          setUploads(prev => {
            const newUploads = { ...prev };
            delete newUploads[employeeId];
            return newUploads;
          });
        }, 10000);
      })
      .catch(error => {
        console.error('❌ Background upload failed for employee:', employeeId, error);
        
        setUploads(prev => ({
          ...prev,
          [employeeId]: {
            status: 'error',
            progress: 0,
            error: error.message || 'Upload failed',
            result: null,
            fileName: file.name
          }
        }));
      });

    return employeeId;
  }, []);

  /**
   * Get upload status for an employee
   */
  const getUploadStatus = useCallback((employeeId) => {
    return uploads[employeeId] || null;
  }, [uploads]);

  /**
   * Clear upload status
   */
  const clearUpload = useCallback((employeeId) => {
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[employeeId];
      return newUploads;
    });
  }, []);

  /**
   * Check if any upload is in progress
   */
  const hasActiveUploads = useCallback(() => {
    return Object.values(uploads).some(upload => upload.status === 'uploading');
  }, [uploads]);

  /**
   * Get all active uploads
   */
  const getActiveUploads = useCallback(() => {
    return Object.entries(uploads)
      .filter(([_, upload]) => upload.status === 'uploading')
      .map(([employeeId, upload]) => ({ employeeId, ...upload }));
  }, [uploads]);

  const value = {
    uploads,
    startPdfUpload,
    getUploadStatus,
    clearUpload,
    hasActiveUploads,
    getActiveUploads
  };

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
};
