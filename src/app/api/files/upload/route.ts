import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processFile } from '@/services/file.service';
import { isSupportedFileType, MAX_FILE_SIZE, SUPPORTED_FILE_TYPES, FileStatus } from '@/types/files';

// Accept JSON metadata (file already uploaded to Supabase Storage from client)
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

    // Parse JSON body (file metadata, not the actual file)
    const body = await request.json();
    const { fileId, filename, originalName, fileType, fileSize, storagePath } = body;

    if (!fileId || !filename || !originalName || !fileType || !storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isSupportedFileType(fileType)) {
      const supportedTypes = Object.values(SUPPORTED_FILE_TYPES)
        .map((t) => t.extension)
        .join(', ');
      return NextResponse.json(
        { error: `Unsupported file type. Supported types: ${supportedTypes}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Create file record in database
    const { error: dbError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        user_id: user.id,
        filename,
        original_name: originalName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
        status: 'pending' as FileStatus,
      });

    if (dbError) {
      console.error('Database insert error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create file record' },
        { status: 500 }
      );
    }

    // Start processing in background (don't await)
    processFile(user.id, fileId).catch((err) => {
      console.error('Background file processing error:', err);
    });

    return NextResponse.json({
      id: fileId,
      filename: originalName,
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

