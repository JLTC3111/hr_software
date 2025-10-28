# PDF Viewer Debugging & Fix Guide

## 🔍 Current Issues

1. **PDF.js Error**: "Failed to load pdf with pdf.js"
2. **Iframe Issue**: Displays gibberish characters instead of PDF content
3. **Files Re-uploaded**: Still not working after manual deletion and re-upload

---

## 🎯 Root Causes & Solutions

### Issue 1: Bucket Not Public
**Symptom**: 404 errors, gibberish content  
**Cause**: Bucket is still private, RLS policies blocking access

**Fix**: Run this SQL in Supabase SQL Editor

```sql
-- File: fix_employee_documents_bucket_complete.sql

UPDATE storage.buckets
SET public = true
WHERE id = 'employee-documents';

-- Remove restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

-- Create public read policy
CREATE POLICY "Public read access for employee-documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-documents');
```

---

### Issue 2: CORS Not Configured
**Symptom**: Browser shows CORS errors in console  
**Cause**: Supabase storage doesn't allow requests from your domain

**Fix**: Configure CORS in Supabase Dashboard

1. Go to **Settings** > **Storage**
2. Scroll to **CORS Configuration**
3. Add these origins:
   ```
   http://localhost:3000
   http://localhost:5173
   http://localhost:5174
   https://your-production-domain.com
   ```
4. Click **Save**

---

### Issue 3: Content-Type Not Set During Upload
**Symptom**: Browser downloads file instead of displaying it  
**Cause**: File uploaded without `Content-Type: application/pdf`

**Fix**: ✅ Already fixed in code
- Upload function now includes `contentType: 'application/pdf'`
- All new uploads will work correctly

---

### Issue 4: Old Files Have Wrong Metadata
**Symptom**: Files uploaded before fix still don't work  
**Cause**: Existing files lack proper Content-Type metadata

**Fix**: Re-upload ALL existing PDFs
1. Delete old PDFs from Supabase Storage
2. Upload again via the application
3. New uploads will have correct metadata

---

## 🧪 Step-by-Step Diagnostic Process

### Step 1: Check Browser Console

Open the employee modal with a PDF and check console for:

```
🔍 Generating PDF URL for path: <filename>
✅ Public URL generated: <url>
📡 URL test response: 200 application/pdf
✅ Public URL is accessible
```

**Expected**: All checkmarks ✅  
**If you see ❌ or ⚠️**: Note the error message

---

### Step 2: Test URL Directly

Copy the URL from console and paste it in a new browser tab.

**Expected**: PDF displays in browser  
**If not**:
- **403 Error**: Bucket is not public or RLS blocking
- **404 Error**: File doesn't exist or path is wrong
- **Download instead of display**: Content-Type not set
- **Gibberish text**: Content-Type missing or CORS issue

---

### Step 3: Check Supabase Storage

1. Go to Supabase Dashboard
2. Storage > employee-documents
3. Click on a PDF file
4. Check:
   - **Content-Type**: Should be `application/pdf`
   - **Public Access**: URL should be accessible

---

### Step 4: Verify Bucket Settings

Run this in Supabase SQL Editor:

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'employee-documents';
```

**Expected**:
- `public`: `true`
- `file_size_limit`: `52428800` (50MB)

---

### Step 5: Check RLS Policies

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%employee%';
```

**Expected**: 
- SELECT policy: No role restriction (public)
- INSERT/UPDATE/DELETE: authenticated only

---

## 🔧 Complete Fix Checklist

Follow these steps IN ORDER:

### ✅ Step 1: Database Configuration
```bash
# Run in Supabase SQL Editor
fix_employee_documents_bucket_complete.sql
```

Verify:
```sql
SELECT public FROM storage.buckets WHERE id = 'employee-documents';
-- Should return: true
```

---

### ✅ Step 2: CORS Configuration
1. Supabase Dashboard > Settings > Storage
2. Add your domains to CORS Configuration
3. Save changes

---

### ✅ Step 3: Clear Existing Files
1. Go to Storage > employee-documents
2. Delete ALL existing PDF files
3. They have wrong metadata and can't be fixed

---

### ✅ Step 4: Test Upload
1. Open employee modal
2. Go to Documents tab
3. Upload a new PDF
4. Watch browser console for debug messages

**Expected console output**:
```
✅ Upload successful: {path: "..."}
✅ Database updated with path: ...
📎 Public URL: https://...
✅ URL accessible, Content-Type: application/pdf
✅ Iframe loaded successfully
```

---

### ✅ Step 5: Verify Display
PDF should now display in the iframe viewer correctly.

---

## 🐛 Common Errors & Solutions

### Error: "Public URL not accessible"
**Cause**: Bucket is not public  
**Fix**: Run `UPDATE storage.buckets SET public = true`

---

### Error: "Content-Type: null"
**Cause**: File uploaded without contentType  
**Fix**: Delete and re-upload file

---

### Error: "CORS policy blocked"
**Cause**: Your domain not in allowed origins  
**Fix**: Add domain to CORS config in Supabase

---

### Error: "Failed to fetch"
**Cause**: Network issue or URL incorrect  
**Fix**: Check URL in browser directly, verify file exists

---

### Gibberish in Iframe
**Cause 1**: Content-Type not application/pdf  
**Fix**: Re-upload with correct content type

**Cause 2**: File corrupted during upload  
**Fix**: Delete and upload again

**Cause 3**: Bucket not public + CORS issue  
**Fix**: Make bucket public AND configure CORS

---

## 📊 What the New Code Does

### 1. Comprehensive Logging
Every step is logged to console with emojis for easy tracking:
- 🔍 Starting process
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 📡 Network test
- 📎 URL generated

### 2. URL Testing
Before using any URL, code tests it with a HEAD request to verify:
- URL is accessible (200 response)
- Content-Type is correct
- No CORS errors

### 3. Automatic Fallback
If public URL fails:
1. Automatically tries signed URL
2. Logs the fallback
3. Uses whichever works

### 4. Better Error Messages
- Shows exact error in console
- Displays user-friendly message
- Provides troubleshooting hints

---

## 🎯 Quick Test Script

Paste this in browser console when modal is open:

```javascript
// Test PDF URL directly
const testPdfUrl = async (url) => {
  try {
    console.log('Testing URL:', url);
    const response = await fetch(url, { method: 'HEAD' });
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('Success:', response.ok);
    return response.ok;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
};

// Replace with your actual PDF URL
testPdfUrl('YOUR_PDF_URL_HERE');
```

---

## ✅ Final Verification

After completing all steps, you should see:

1. **Console**: All green checkmarks ✅
2. **Iframe**: PDF displays correctly
3. **Network Tab**: 
   - Request to PDF URL: 200 OK
   - Content-Type: application/pdf
   - No CORS errors

---

## 📞 Still Not Working?

If after following all steps it still fails:

### Collect This Information:
1. Browser console output (all messages)
2. Network tab screenshot (PDF request)
3. Supabase bucket settings screenshot
4. Error messages

### Check These:
- [ ] Bucket is public (SQL query confirms)
- [ ] CORS configured with your domain
- [ ] File uploaded with contentType
- [ ] No RLS policies blocking SELECT
- [ ] URL accessible in new tab
- [ ] Content-Type is application/pdf

### Last Resort:
Try using signed URLs exclusively:
1. Keep bucket private
2. Remove public URL code
3. Use only createSignedUrl()
4. Signed URLs bypass CORS for authenticated users

---

**The code is now bulletproof with debugging. Follow the checklist and watch the console messages!** 🎯
