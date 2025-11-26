import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, processFile } from '@/services/file.service';
import { isSupportedFileType, MAX_FILE_SIZE, SUPPORTED_FILE_TYPES } from '@/types/files';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isSupportedFileType(file.type)) {
      const supportedTypes = Object.values(SUPPORTED_FILE_TYPES)
        .map((t) => t.extension)
        .join(', ');
      return NextResponse.json(
        { error: `Unsupported file type. Supported types: ${supportedTypes}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Upload file
    const { fileId, error: uploadError } = await uploadFile(user.id, file);

    if (uploadError || !fileId) {
      return NextResponse.json(
        { error: uploadError || 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Start processing in background (don't await)
    processFile(user.id, fileId).catch((err) => {
      console.error('Background file processing error:', err);
    });

    return NextResponse.json({
      id: fileId,
      filename: file.name,
      status: 'pending',
      message: 'File uploaded successfully. Processing will begin shortly.',
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get upload constraints
export async function GET() {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    supportedTypes: Object.entries(SUPPORTED_FILE_TYPES).map(([mimeType, config]) => ({
      mimeType,
      extension: config.extension,
    })),
  });
}

