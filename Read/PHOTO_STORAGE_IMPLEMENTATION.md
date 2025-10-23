# 📸 Employee Photo Storage - Implementation Guide

## 🎯 Overview

This document provides a comprehensive guide for implementing a production-ready employee photo storage system using Supabase Storage with metadata tracking, image optimization, and version history.

---

## 🏗️ Architecture

### **Current Implementation**
- ✅ `employees.photo` TEXT field stores base64 or URLs
- ✅ Basic `uploadEmployeePhoto()` in employeeService.js
- ✅ UI components for photo upload/display

### **Enhanced Implementation**
- ✅ Dedicated `employee_photos` table for metadata
- ✅ Image optimization (resize, compress, thumbnails)
- ✅ Version history and audit trail
- ✅ Automatic cleanup of old photos
- ✅ Soft delete support
- ✅ Orphaned file detection

---

## 📋 Implementation Steps

### **Phase 1: Database Setup**

#### **Step 1.1: Run Migration**
```bash
cd /Users/skycastle3/Desktop/ICUE_company_software/hr_software
```

Apply the migration via Supabase Dashboard:
1. Go to **SQL Editor**
2. Open `supabase/migrations/010_employee_photos_table.sql`
3. Copy contents and paste into SQL Editor
4. Click **Run**

**What it creates:**
- ✅ `employee_photos` table with metadata columns
- ✅ Indexes for performance
- ✅ Triggers to ensure single current photo per employee
- ✅ Automatic sync with `employees.photo` field
- ✅ Views for current photos and history
- ✅ RLS policies for security
- ✅ Helper functions for soft delete and orphan cleanup

---

### **Phase 2: Storage Bucket Setup**

#### **Step 2.1: Create Storage Bucket**
1. Go to Supabase Dashboard → **Storage**
2. Click **New Bucket**
3. Configure:
   - **Name:** `employee-photos`
   - **Public:** ✅ YES
   - **File size limit:** 5MB (5242880 bytes)
   - **Allowed MIME types:** `image/jpeg, image/png, image/gif, image/webp`

#### **Step 2.2: Set Storage Policies**
Navigate to **Storage** → **Policies** → `employee-photos` bucket

**Policy 1: Public Read Access to Originals**
```sql
bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = 'originals'
```

**Policy 2: Public Read Access to Thumbnails**
```sql
bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = 'thumbnails'
```

**Policy 3: Authenticated Upload**
```sql
bucket_id = 'employee-photos' AND auth.role() = 'authenticated'
```

**Policy 4: Authenticated Update**
```sql
bucket_id = 'employee-photos' AND auth.role() = 'authenticated'
```

---

### **Phase 3: Service Layer Integration**

#### **Step 3.1: Import Enhanced Photo Service**
Update `src/services/employeeService.js`:

```javascript
// At the top of the file
import {
  uploadEmployeePhotoEnhanced,
  getEmployeePhotoHistory,
  getCurrentEmployeePhoto,
  softDeleteEmployeePhoto,
  findOrphanedPhotos
} from './enhancedPhotoService';

// Update exports at the bottom
export default {
  // ... existing exports
  
  // Enhanced Photo Management
  uploadEmployeePhotoEnhanced,
  getEmployeePhotoHistory,
  getCurrentEmployeePhoto,
  softDeleteEmployeePhoto,
  findOrphanedPhotos
};
```

#### **Step 3.2: Update Components to Use Enhanced Upload**

**In `employeeCard.jsx`:**
```javascript
import { uploadEmployeePhotoEnhanced } from '../services/enhancedPhotoService';

const handlePhotoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  setIsUploading(true);
  try {
    // Use enhanced upload with metadata tracking
    const result = await uploadEmployeePhotoEnhanced(file, employee.id, currentUser?.id);
    
    if (result.success) {
      // Photo URL and thumbnail automatically synced to employees table via trigger
      onPhotoUpdate(employee.id, result.url);
      console.log('Photo uploaded:', {
        url: result.url,
        thumbnail: result.thumbnailUrl,
        size: result.fileSize,
        dimensions: `${result.width}x${result.height}`
      });
    } else {
      alert('Failed to upload photo: ' + result.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Failed to upload photo');
  } finally {
    setIsUploading(false);
  }
};
```

---

### **Phase 4: UI Enhancements**

#### **Step 4.1: Add Photo History Modal**
Create `src/components/photoHistoryModal.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { getEmployeePhotoHistory } from '../services/enhancedPhotoService';
import { History, X, Download, Trash2 } from 'lucide-react';

const PhotoHistoryModal = ({ employeeId, isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchHistory();
    }
  }, [isOpen, employeeId]);

  const fetchHistory = async () => {
    setLoading(true);
    const result = await getEmployeePhotoHistory(employeeId);
    if (result.success) {
      setHistory(result.data || []);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Photo History
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((photo) => (
              <div key={photo.id} className="border rounded-lg p-4 relative">
                {photo.is_current && (
                  <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Current
                  </span>
                )}
                <img 
                  src={photo.photo_url} 
                  alt={photo.file_name}
                  className="w-full h-48 object-cover rounded mb-2"
                />
                <p className="text-sm font-medium truncate">{photo.file_name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(photo.uploaded_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500">
                  Size: {(photo.file_size / 1024).toFixed(1)} KB
                </p>
                <p className="text-xs">
                  <span className={`px-2 py-0.5 rounded ${
                    photo.status === 'current' ? 'bg-green-100 text-green-800' :
                    photo.status === 'deleted' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {photo.status}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoHistoryModal;
```

#### **Step 4.2: Add History Button to Employee Modal**
In `employeeModal.jsx`:

```javascript
import PhotoHistoryModal from './photoHistoryModal';

// Add state
const [showPhotoHistory, setShowPhotoHistory] = useState(false);

// Add button in header
<button
  onClick={() => setShowPhotoHistory(true)}
  className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
>
  <History className="h-4 w-4" />
  Photo History
</button>

// Add modal
<PhotoHistoryModal 
  employeeId={employee.id}
  isOpen={showPhotoHistory}
  onClose={() => setShowPhotoHistory(false)}
/>
```

---

### **Phase 5: Testing & Validation**

#### **Test Checklist:**
- [ ] Upload new employee photo
- [ ] Verify photo appears in `employee_photos` table
- [ ] Verify `employees.photo` field is updated automatically
- [ ] Verify thumbnail is generated
- [ ] Upload second photo for same employee
- [ ] Verify only one photo is marked as `is_current`
- [ ] Verify old photo is archived (not deleted)
- [ ] View photo history
- [ ] Test soft delete
- [ ] Test orphaned photo detection

---

## 🔐 Security Best Practices

### **1. RLS Policies**
✅ Already configured in migration:
- Public can read current photos
- Authenticated users can upload
- Authenticated users can update/delete

### **2. File Validation**
```javascript
const validatePhotoFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
  }

  if (file.size > maxSize) {
    throw new Error('File size must be less than 5MB');
  }

  return true;
};
```

### **3. Content Security**
- ✅ Images are optimized before upload (prevent huge files)
- ✅ Thumbnails reduce bandwidth usage
- ✅ CDN caching via `cacheControl: '3600'`

---

## 🚀 Performance Optimizations

### **1. Use Thumbnails for Lists**
In `employeeCard.jsx`, display thumbnail in cards:

```javascript
const photoUrl = employee.thumbnail_url || employee.photo;

<img src={photoUrl} alt={employee.name} className="..." />
```

### **2. Lazy Load Images**
```javascript
<img 
  src={photoUrl} 
  loading="lazy"
  alt={employee.name} 
/>
```

### **3. Progressive Image Loading**
Use blur placeholder:

```javascript
const [imageLoaded, setImageLoaded] = useState(false);

<div className="relative">
  {!imageLoaded && (
    <div className="absolute inset-0 bg-gray-200 animate-pulse" />
  )}
  <img 
    src={photoUrl}
    onLoad={() => setImageLoaded(true)}
    className={`transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
  />
</div>
```

---

## 🧹 Maintenance Tasks

### **1. Monthly Cleanup Job**
Create scheduled function to clean orphaned photos:

```javascript
// Run this monthly via cron job or manually
export const cleanupOrphanedPhotos = async () => {
  const { data: orphans } = await findOrphanedPhotos();
  
  for (const photo of orphans) {
    // Delete from storage
    await supabase.storage
      .from('employee-photos')
      .remove([photo.storage_path]);
    
    // Delete from database
    await supabase
      .from('employee_photos')
      .delete()
      .eq('id', photo.id);
  }
  
  console.log(`Cleaned up ${orphans.length} orphaned photos`);
};
```

### **2. Archive Old Photos**
Move deleted photos to archives folder:

```javascript
export const archiveDeletedPhoto = async (photoId) => {
  const { data: photo } = await supabase
    .from('employee_photos')
    .select('*')
    .eq('id', photoId)
    .single();

  if (!photo || !photo.deleted_at) return;

  const oldPath = photo.storage_path;
  const newPath = oldPath.replace('originals/', 'archives/');

  // Move file in storage
  await supabase.storage
    .from('employee-photos')
    .move(oldPath, newPath);

  // Update database
  await supabase
    .from('employee_photos')
    .update({ storage_path: newPath })
    .eq('id', photoId);
};
```

---

## 📊 Monitoring & Analytics

### **1. Storage Usage Query**
```sql
SELECT 
  COUNT(*) as total_photos,
  SUM(file_size) as total_size_bytes,
  ROUND(SUM(file_size)::numeric / 1024 / 1024, 2) as total_size_mb,
  COUNT(*) FILTER (WHERE is_current = true) as current_photos,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_photos
FROM employee_photos;
```

### **2. Most Recent Uploads**
```sql
SELECT 
  e.name,
  ep.file_name,
  ep.file_size,
  ep.uploaded_at
FROM employee_photos ep
JOIN employees e ON ep.employee_id = e.id
WHERE ep.is_current = true
ORDER BY ep.uploaded_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### **Issue: Photos not uploading**
1. Check storage bucket exists in Dashboard
2. Verify bucket is public
3. Check storage policies are set correctly
4. Inspect browser console for errors
5. Test with smaller image file

### **Issue: Thumbnails not generating**
1. Check canvas API support in browser
2. Verify image file is valid format
3. Check console for resize errors
4. Ensure enough memory for large images

### **Issue: Old photos not archiving**
1. Verify trigger `trigger_single_current_photo` is enabled
2. Check `is_current` field is updating correctly
3. Run manual query to check photo status

### **Issue: employees.photo not syncing**
1. Verify trigger `trigger_sync_employee_photo` is enabled
2. Check trigger function for errors
3. Manually update via SQL if needed

---

## 📚 Additional Resources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [RLS Policies Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Image Optimization Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images)

---

## ✅ Summary

**What You Get:**
- ✅ Production-ready photo storage system
- ✅ Automatic image optimization and thumbnails
- ✅ Full version history and audit trail
- ✅ Soft delete with easy recovery
- ✅ Automatic sync with employees table
- ✅ Orphaned file detection and cleanup
- ✅ Security with RLS policies
- ✅ Performance with CDN caching

**Next Steps:**
1. Run migration in Supabase SQL Editor
2. Create storage bucket via Dashboard
3. Set up storage policies
4. Test upload functionality
5. Implement photo history UI
6. Set up monthly cleanup job

Good luck! 🚀
