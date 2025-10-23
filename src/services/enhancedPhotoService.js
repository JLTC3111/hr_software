// Enhanced Photo Management Service
// Add these functions to employeeService.js

/**
 * Resize image using canvas API for optimization
 */
const resizeImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve({
              blob,
              width: Math.round(width),
              height: Math.round(height),
              originalWidth: img.width,
              originalHeight: img.height
            });
          },
          file.type || 'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Create thumbnail from image file
 */
const createThumbnail = (file, size = 150) => {
  return resizeImage(file, size, size, 0.8);
};

/**
 * Enhanced upload with metadata tracking
 * Replace existing uploadEmployeePhoto or add alongside it
 */
export const uploadEmployeePhotoEnhanced = async (fileData, employeeId, uploadedBy = null) => {
  try {
    let file = fileData;
    let fileName;
    let fileExt;
    let mimeType;
    
    // Handle base64 strings
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1];
      mimeType = fileData.match(/data:(.*?);/)[1];
      fileExt = mimeType.split('/')[1];
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      file = new Blob([byteArray], { type: mimeType });
      fileName = `${employeeId}_${Date.now()}.${fileExt}`;
    } else {
      mimeType = file.type || 'image/jpeg';
      fileExt = file.name.split('.').pop();
      fileName = `${employeeId}_${Date.now()}.${fileExt}`;
    }

    // Optimize image before upload
    let optimizedFile = file;
    let imageWidth = null;
    let imageHeight = null;
    let thumbnailUrl = null;

    try {
      const { blob, width, height } = await resizeImage(file, 800, 800, 0.85);
      optimizedFile = blob;
      imageWidth = width;
      imageHeight = height;
    } catch (resizeError) {
      console.warn('Image resize failed, using original:', resizeError.message);
    }

    // Upload paths
    const originalPath = `originals/${fileName}`;
    const thumbnailPath = `thumbnails/${fileName.replace(`.${fileExt}`, `_thumb.${fileExt}`)}`;

    // Upload original to storage
    const { data, error } = await supabase.storage
      .from('employee-photos')
      .upload(originalPath, optimizedFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType
      });

    if (error) {
      console.warn('Storage upload failed:', error.message);
      throw error;
    }

    // Upload thumbnail
    try {
      const { blob: thumbBlob } = await createThumbnail(file);
      const { data: thumbData } = await supabase.storage
        .from('employee-photos')
        .upload(thumbnailPath, thumbBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType
        });

      if (thumbData) {
        const { data: thumbUrlData } = supabase.storage
          .from('employee-photos')
          .getPublicUrl(thumbnailPath);
        thumbnailUrl = thumbUrlData.publicUrl;
      }
    } catch (thumbError) {
      console.warn('Thumbnail generation failed:', thumbError.message);
    }

    // Get public URL for original
    const { data: publicUrlData } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(originalPath);

    // Save metadata to employee_photos table
    const photoMetadata = {
      employee_id: parseInt(employeeId),
      photo_url: publicUrlData.publicUrl,
      storage_path: originalPath,
      file_name: fileName,
      file_size: optimizedFile.size,
      mime_type: mimeType,
      width: imageWidth,
      height: imageHeight,
      thumbnail_url: thumbnailUrl,
      is_current: true,
      uploaded_by: uploadedBy ? parseInt(uploadedBy) : null
    };

    const { data: photoData, error: dbError } = await supabase
      .from('employee_photos')
      .insert(photoMetadata)
      .select()
      .single();

    if (dbError) {
      console.error('Failed to save photo metadata:', dbError);
    }

    return {
      success: true,
      url: publicUrlData.publicUrl,
      thumbnailUrl: thumbnailUrl,
      fileName: fileName,
      fileType: mimeType,
      fileSize: optimizedFile.size,
      width: imageWidth,
      height: imageHeight,
      storage: 'supabase',
      photoId: photoData?.id
    };
  } catch (error) {
    console.error('Error uploading employee photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get employee photo history
 */
export const getEmployeePhotoHistory = async (employeeId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_employee_photo_history', { p_employee_id: parseInt(employeeId) });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching photo history:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get current employee photo with thumbnail
 */
export const getCurrentEmployeePhoto = async (employeeId) => {
  try {
    const { data, error } = await supabase
      .from('employee_photos')
      .select('*')
      .eq('employee_id', parseInt(employeeId))
      .eq('is_current', true)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching current photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Archive old photo and set new one as current
 */
export const replaceEmployeePhoto = async (employeeId, newPhotoUrl) => {
  try {
    // Mark old photo as not current
    const { error: updateError } = await supabase
      .from('employee_photos')
      .update({ is_current: false })
      .eq('employee_id', parseInt(employeeId))
      .eq('is_current', true);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error replacing photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Soft delete employee photo
 */
export const softDeleteEmployeePhoto = async (photoId) => {
  try {
    const { data, error } = await supabase
      .rpc('soft_delete_photo', { p_photo_id: photoId });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error soft deleting photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Find and cleanup orphaned photos
 */
export const findOrphanedPhotos = async () => {
  try {
    const { data, error } = await supabase
      .rpc('find_orphaned_photos');

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error finding orphaned photos:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete photo from storage (use with caution)
 */
export const deletePhotoFromStorage = async (storagePath) => {
  try {
    const { error } = await supabase.storage
      .from('employee-photos')
      .remove([storagePath]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting photo from storage:', error);
    return { success: false, error: error.message };
  }
};
