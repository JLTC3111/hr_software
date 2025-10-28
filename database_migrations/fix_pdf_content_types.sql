-- Fix PDF Content Types in Supabase Storage
-- This updates metadata for existing PDFs to ensure they are served with correct MIME type

-- Note: This is a reference script. The actual fix requires using Supabase Storage API
-- because PostgreSQL doesn't directly manage storage object metadata.

-- ========================================
-- OPTION 1: Via Supabase Dashboard
-- ========================================
-- 1. Go to Storage > employee-documents
-- 2. For each PDF file, click the 3 dots menu
-- 3. Select "Update" or "Edit metadata"
-- 4. Set Content-Type to: application/pdf

-- ========================================
-- OPTION 2: Via JavaScript (Run in browser console or Node.js)
-- ========================================
/*
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SERVICE_ROLE_KEY'  // Need service role key for this operation
);

async function fixPdfContentTypes() {
  // List all files in employee-documents bucket
  const { data: files, error } = await supabase.storage
    .from('employee-documents')
    .list();

  if (error) {
    console.error('Error listing files:', error);
    return;
  }

  // Filter PDF files
  const pdfFiles = files.filter(file => file.name.endsWith('.pdf'));

  console.log(`Found ${pdfFiles.length} PDF files`);

  // Update each PDF file's metadata
  for (const file of pdfFiles) {
    try {
      // Download the file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('employee-documents')
        .download(file.name);

      if (downloadError) {
        console.error(`Error downloading ${file.name}:`, downloadError);
        continue;
      }

      // Re-upload with correct content type
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(file.name, fileData, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true  // Overwrite existing file
        });

      if (uploadError) {
        console.error(`Error re-uploading ${file.name}:`, uploadError);
      } else {
        console.log(`✅ Fixed content type for: ${file.name}`);
      }
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
    }
  }

  console.log('All PDFs processed!');
}

// Run the fix
fixPdfContentTypes();
*/

-- ========================================
-- OPTION 3: Delete and Re-upload (Manual)
-- ========================================
-- If you have few PDFs, the easiest way is:
-- 1. Download the PDF from Supabase Storage
-- 2. Delete the old file
-- 3. Re-upload with the fixed upload function (now includes contentType)

-- ========================================
-- VERIFICATION
-- ========================================
-- After fixing, verify by:
-- 1. Opening the public URL in browser
-- 2. Should display PDF, not download
-- 3. Check response headers: Content-Type should be "application/pdf"

-- You can check in browser DevTools:
-- Network tab > Click on PDF request > Headers > Response Headers > Content-Type

-- ========================================
-- PREVENTION (Already Fixed)
-- ========================================
-- The employeeDetailModal.jsx upload function now includes:
-- contentType: 'application/pdf'
-- All new uploads will have correct content type automatically.
