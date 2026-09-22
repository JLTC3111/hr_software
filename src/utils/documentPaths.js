export const EMPLOYEE_DOCUMENT_BUCKET = 'employee-documents';
export const DOCUMENT_URL_TTL_SECONDS = 600;

// Old rows contain public URLs; newer rows can store the object path. Neither
// format should keep a download authorized indefinitely.
export const getEmployeeDocumentPath = (value, supabaseUrl) => {
  if (!value || typeof value !== 'string') throw new Error('Document path is required');
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.origin !== new URL(supabaseUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/employee-documents\/(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  }
  if (value.startsWith('/') || value.includes('://') || value.split('/').some(part => part === '..')) {
    throw new Error('Invalid document path');
  }
  return value;
};
