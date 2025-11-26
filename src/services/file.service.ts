import { createClient } from '@/lib/supabase/server';
import { FileRecord, FileStatus, isSupportedFileType, MAX_FILE_SIZE } from '@/types/files';
import { parseDocument } from './document-parser.service';
import { chunkText, chunkCSV, TextChunk } from './chunking.service';
import { generateEmbeddings, estimateTokenCount } from './embedding.service';
import { upsertVectors, deleteVectorsByFileId, buildVectorRecords } from './pinecone.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload a file and store metadata
 */
export async function uploadFile(
  userId: string,
  file: File
): Promise<{ fileId: string; error?: string }> {
  // Validate file type
  if (!isSupportedFileType(file.type)) {
    return { fileId: '', error: `Unsupported file type: ${file.type}` };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { fileId: '', error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  const supabase = await createClient();
  const fileId = uuidv4();
  const filename = `${fileId}-${file.name}`;
  const storagePath = `${userId}/${filename}`;

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('user-files')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return { fileId: '', error: 'Failed to upload file to storage' };
  }

  // Create file record
  const { error: dbError } = await supabase
    .from('files')
    .insert({
      id: fileId,
      user_id: userId,
      filename,
      original_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      status: 'pending' as FileStatus,
    });

  if (dbError) {
    console.error('Database insert error:', dbError);
    // Try to clean up uploaded file
    await supabase.storage.from('user-files').remove([storagePath]);
    return { fileId: '', error: 'Failed to create file record' };
  }

  return { fileId };
}

/**
 * Process a file: extract text, chunk, embed, and store vectors
 */
export async function processFile(
  userId: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get file record
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (fileError || !file) {
    return { success: false, error: 'File not found' };
  }

  // Update status to processing
  await updateFileStatus(fileId, 'processing');

  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('user-files')
      .download(file.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file from storage');
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Parse document
    if (!isSupportedFileType(file.file_type)) {
      throw new Error('Unsupported file type');
    }

    const parsed = await parseDocument(buffer, file.file_type, file.original_name);

    // Chunk the document
    let chunks: TextChunk[];
    if (parsed.structuredData) {
      // Use structured chunking for CSV
      chunks = chunkCSV(parsed.structuredData.headers, parsed.structuredData.rows);
    } else {
      chunks = chunkText(parsed.text);
    }

    if (chunks.length === 0) {
      throw new Error('No content extracted from file');
    }

    // Generate embeddings
    const chunkTexts = chunks.map((c) => c.content);
    const { embeddings } = await generateEmbeddings(chunkTexts);

    // Prepare chunk records for database
    const chunkRecords = chunks.map((chunk, i) => {
      const chunkId = uuidv4();
      return {
        id: chunkId,
        file_id: fileId,
        user_id: userId,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: estimateTokenCount(chunk.content),
        pinecone_id: chunkId,
        metadata: {
          filename: file.original_name,
          file_type: file.file_type,
          chunk_index: chunk.index,
          total_chunks: chunks.length,
          ...chunk.metadata,
        },
      };
    });

    // Insert chunks into database
    const { error: chunkError } = await supabase
      .from('chunks')
      .insert(chunkRecords);

    if (chunkError) {
      throw new Error('Failed to save chunks to database');
    }

    // Build and upsert vectors to Pinecone
    const vectorRecords = buildVectorRecords(
      userId,
      fileId,
      file.original_name,
      file.file_type,
      chunkRecords.map((c) => ({ id: c.id, content: c.content, index: c.chunk_index })),
      embeddings.map((e) => e.embedding)
    );

    await upsertVectors(userId, vectorRecords);

    // Update file status to ready
    await supabase
      .from('files')
      .update({
        status: 'ready' as FileStatus,
        chunk_count: chunks.length,
      })
      .eq('id', fileId);

    return { success: true };
  } catch (error) {
    console.error('File processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update status to failed
    await supabase
      .from('files')
      .update({
        status: 'failed' as FileStatus,
        error_message: errorMessage,
      })
      .eq('id', fileId);

    return { success: false, error: errorMessage };
  }
}

/**
 * Update file status
 */
async function updateFileStatus(fileId: string, status: FileStatus): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('files')
    .update({ status })
    .eq('id', fileId);
}

/**
 * Get all files for a user
 */
export async function getUserFiles(userId: string): Promise<FileRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching files:', error);
    return [];
  }

  return data as FileRecord[];
}

/**
 * Get a single file by ID
 */
export async function getFileById(
  userId: string,
  fileId: string
): Promise<FileRecord | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data as FileRecord;
}

/**
 * Delete a file and its associated data
 */
export async function deleteFile(
  userId: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get file record
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('storage_path')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (fileError || !file) {
    return { success: false, error: 'File not found' };
  }

  try {
    // Delete vectors from Pinecone
    await deleteVectorsByFileId(userId, fileId);

    // Delete from storage
    await supabase.storage.from('user-files').remove([file.storage_path]);

    // Delete file record (chunks will cascade delete)
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error('Failed to delete file record');
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: 'Failed to delete file' };
  }
}

