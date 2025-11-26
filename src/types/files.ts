// File upload and RAG types

export type FileStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface FileRecord {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: FileStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChunkRecord {
  id: string;
  file_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  pinecone_id: string;
  metadata: ChunkMetadata | null;
  created_at: string;
}

export interface ChunkMetadata {
  filename: string;
  file_type: string;
  chunk_index: number;
  total_chunks: number;
  page_number?: number;
  section?: string;
}

// Upload request/response types
export interface FileUploadRequest {
  file: File;
}

export interface FileUploadResponse {
  id: string;
  filename: string;
  status: FileStatus;
  message: string;
}

export interface FileListResponse {
  files: FileRecord[];
}

export interface FileProcessRequest {
  fileId: string;
}

export interface FileProcessResponse {
  status: 'extracting' | 'chunking' | 'embedding' | 'complete' | 'error';
  progress: number;
  message?: string;
}

// Chunking configuration
export interface ChunkConfig {
  chunkSize: number;      // Target chunk size in characters
  chunkOverlap: number;   // Overlap between chunks
  minChunkSize: number;   // Minimum chunk size to keep
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 1000,        // ~250 tokens
  chunkOverlap: 200,      // ~50 tokens overlap
  minChunkSize: 100,      // Minimum 100 chars
};

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': { extension: '.pdf', parser: 'pdf-parse' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: '.docx', parser: 'mammoth' },
  'text/plain': { extension: '.txt', parser: 'native' },
  'text/markdown': { extension: '.md', parser: 'native' },
  'text/csv': { extension: '.csv', parser: 'papaparse' },
  'application/json': { extension: '.json', parser: 'native' },
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_FILE_TYPES;

export function isSupportedFileType(mimeType: string): mimeType is SupportedMimeType {
  return mimeType in SUPPORTED_FILE_TYPES;
}

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

