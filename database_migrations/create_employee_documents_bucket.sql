-- Create storage bucket for employee PDF documents
-- Run this in Supabase SQL Editor

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for employee-documents bucket

-- Policy 1: Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-documents');

-- Policy 2: Allow authenticated users to read documents
CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-documents');

-- Policy 3: Allow authenticated users to update documents
CREATE POLICY "Authenticated users can update employee documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-documents');

-- Policy 4: Allow authenticated users to delete documents
CREATE POLICY "Authenticated users can delete employee documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-documents');

-- Add pdf_document_url column to employees table if it doesn't exist
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS pdf_document_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN employees.pdf_document_url IS 'URL path to employee PDF document stored in employee-documents bucket';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Employee documents bucket created successfully!';
  RAISE NOTICE 'Bucket name: employee-documents';
  RAISE NOTICE 'Public access: false (authenticated only)';
  RAISE NOTICE 'Column added: employees.pdf_document_url';
END $$;
