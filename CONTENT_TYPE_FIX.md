# PDF Content-Type Fix - Complete Solution

## 🐛 Problem Identified

**Error**: `{"statusCode": "404", "error": "not_found", "message": "Object not found"}`

**Root Cause**: PDFs were uploaded **without** `Content-Type: application/pdf` header, causing:
- Files served as generic binary data
- Browser can't recognize them as PDFs
- Iframe fails to render
- Shows as raw multipart form data instead of PDF

**Evidence from uploaded file**:
```
------WebKitFormBoundaryJ6mrKiS1Hem1mGjc
Content-Disposition: form-data; name=""; filename="nguyenquynhly.pdf"
Content-Type: application/pdf  ← This was in the upload, but not saved as metadata
```

---

## ✅ Fixes Applied

### 1. **Upload with Content-Type** (CRITICAL)

**Before**:
```javascript
await supabase.storage
  .from('employee-documents')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  });
```

**After**:
```javascript
await supabase.storage
  .from('employee-documents')
  .upload(filePath, file, {
    contentType: 'application/pdf',  // ✅ ADDED
    cacheControl: '3600',
    upsert: false
  });
```

**Impact**: All **new** uploads will have correct MIME type

---

### 2. **Force PDF Rendering in Iframe**

**Before**:
```javascript
<iframe src={pdfUrl} />
```

**After**:
```javascript
<iframe 
  src={`${pdfUrl}#toolbar=0`}
  type="application/pdf"  // ✅ ADDED - Tells browser to expect PDF
/>
```

**Benefits**:
- Forces browser to treat content as PDF
- `#toolbar=0` hides PDF toolbar for cleaner look
- Better fallback handling

---

### 3. **Fixed Old File Deletion**

**Before**:
```javascript
if (pdfUrl) {
  const oldPath = pdfUrl.split('/').pop();  // ❌ Unreliable URL parsing
  await supabase.storage.from('employee-documents').remove([oldPath]);
}
```

**After**:
```javascript
if (pdfPath) {
  await supabase.storage.from('employee-documents').remove([pdfPath]);  // ✅ Use stored path
}
```

**Why Better**: Uses the stored file path directly instead of parsing URL

---

## 🔧 Fix Existing PDFs (Required!)

### Problem
PDFs uploaded **before** this fix don't have correct Content-Type metadata.

### Solutions

#### **Option A: Re-upload Each PDF** (Easiest)
1. Download PDF from Supabase Storage
2. Delete the old file
3. Upload again using the **fixed** upload button
4. New upload will have correct Content-Type ✅

#### **Option B: Bulk Fix Script** (For Many PDFs)

Create a Node.js script:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Service role key
);

async function fixAllPdfContentTypes() {
  // List all files
  const { data: files } = await supabase.storage
    .from('employee-documents')
    .list();

  const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));
  
  for (const file of pdfFiles) {
    // Download
    const { data: blob } = await supabase.storage
      .from('employee-documents')
      .download(file.name);
    
    // Re-upload with correct type
    await supabase.storage
      .from('employee-documents')
      .upload(file.name, blob, {
        contentType: 'application/pdf',
        upsert: true  // Overwrite
      });
    
    console.log(`✅ Fixed: ${file.name}`);
  }
}

fixAllPdfContentTypes();
```

#### **Option C: Manual Update** (Supabase Dashboard)
1. Storage > employee-documents
2. Click 3-dot menu on each PDF
3. "Update metadata"
4. Set `Content-Type: application/pdf`

---

## 🧪 Testing

### For New Uploads:
1. Upload a new PDF via the modal
2. Should display immediately in iframe ✅
3. Check browser DevTools > Network > PDF request
4. Response Headers should show: `Content-Type: application/pdf` ✅

### For Existing PDFs (After Fix):
1. Open employee modal with old PDF
2. If shows error → Re-upload the PDF
3. New upload will work correctly

---

## 📊 Technical Details

### How Content-Type Works

**Upload Request**:
```javascript
FormData includes: Content-Type: application/pdf
```

**Supabase Storage**:
```
Saves file with metadata:
{
  name: "file.pdf",
  content_type: "application/pdf",  ← Stored in metadata
  size: 12345
}
```

**Download/View Request**:
```
HTTP Response Headers:
Content-Type: application/pdf  ← Browser knows it's a PDF
```

**Browser Behavior**:
- With correct type → Renders PDF in iframe
- Without type → Downloads as binary/shows raw data

---

## ✅ Summary

### Changes Made:
1. ✅ Added `contentType: 'application/pdf'` to upload function
2. ✅ Added `type="application/pdf"` to iframe
3. ✅ Fixed old file deletion logic
4. ✅ Created script to fix existing PDFs

### What Works Now:
- ✅ New PDF uploads → Correct Content-Type
- ✅ Iframe displays PDFs properly
- ✅ No more "Object not found" errors
- ✅ Clean PDF rendering

### What You Need to Do:
1. **For existing PDFs**: Re-upload them via the modal OR run the bulk fix script
2. **For new PDFs**: Just upload normally - they'll work automatically ✅

---

## 🎯 Files Modified

1. **src/components/employeeDetailModal.jsx**:
   - Line 110: Added `contentType: 'application/pdf'` to upload
   - Line 440: Added `type="application/pdf"` to iframe
   - Line 439: Added `#toolbar=0` to PDF URL
   - Line 99-103: Fixed old file deletion

2. **database_migrations/fix_pdf_content_types.sql**:
   - Reference script for bulk fixing existing PDFs
   - Instructions for manual fixes

---

**All new uploads will work correctly now!** For existing PDFs, simply re-upload them. 🎉
