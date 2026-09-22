import { useState } from 'react';
import { downloadEmployeeDocument } from '../../services/documentService.js';
import { getEmployeeDocumentPath } from '../../utils/documentPaths.js';

// Download through the authenticated Storage API. Persisted public/signed URLs
// are treated as object references, so old rows keep working after expiry.
export function DocumentLink({ href, fileName, local = false, onError, children, ...props }) {
  const [loading, setLoading] = useState(false);
  let path;
  try {
    path = local ? null : getEmployeeDocumentPath(href, import.meta.env.VITE_SUPABASE_URL);
  } catch {
    // Report malformed legacy references through the click error state instead
    // of crashing the surrounding attendance/candidate screen while rendering.
    path = undefined;
  }

  const download = async (event) => {
    if (path === null) return;
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const blob = await downloadEmployeeDocument(path ?? href);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || path.split('/').pop();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return <a {...props} href={path === null ? href : '#'} onClick={download} aria-busy={loading}>{children}</a>;
}
