/** Give locally stored PDFs the same preview origin as IndexedDB documents. */
export const createPdfPreviewUrl = async (storedUrl) => {
  if (!/^data:/i.test(storedUrl)) return storedUrl;
  if (!/^data:application\/pdf[;,]/i.test(storedUrl)) {
    throw new Error('Stored document is not a PDF');
  }
  const response = await fetch(storedUrl);
  if (!response.ok) throw new Error('Could not read stored PDF');
  return URL.createObjectURL(await response.blob());
};

/** A separate PDF window may still need its URL after the modal is closed. */
export const releasePdfPreviewUrl = (url, previewWindows = []) => {
  if (typeof url !== 'string' || !url.startsWith('blob:')) return;
  const releaseIfUnused = () => {
    if (previewWindows.some((preview) => !preview.closed)) return false;
    URL.revokeObjectURL(url);
    return true;
  };
  if (releaseIfUnused()) return;
  const timer = globalThis.setInterval(() => {
    if (releaseIfUnused()) globalThis.clearInterval(timer);
  }, 1000);
};
