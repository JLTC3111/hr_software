import { supabase } from '../config/supabaseClient.js';
import { DOCUMENT_URL_TTL_SECONDS, EMPLOYEE_DOCUMENT_BUCKET, getEmployeeDocumentPath } from '../utils/documentPaths.js';

export const getDocumentDownloadUrl = async (pathOrUrl) => {
  const path = getEmployeeDocumentPath(pathOrUrl, import.meta.env.VITE_SUPABASE_URL);
  // Recruitment also supports resumes hosted by an external provider.
  if (path === null) return { success: true, url: pathOrUrl, type: 'external' };
  const { data, error } = await supabase.storage
    .from(EMPLOYEE_DOCUMENT_BUCKET)
    .createSignedUrl(path, DOCUMENT_URL_TTL_SECONDS);
  if (error) throw error;
  return { success: true, url: data.signedUrl, type: 'signed' };
};

export const downloadEmployeeDocument = async (pathOrUrl) => {
  const path = getEmployeeDocumentPath(pathOrUrl, import.meta.env.VITE_SUPABASE_URL);
  if (path === null) throw new Error('This document is hosted externally');
  const { data, error } = await supabase.storage.from(EMPLOYEE_DOCUMENT_BUCKET).download(path);
  if (error) throw error;
  return data;
};
