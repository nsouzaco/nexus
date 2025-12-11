// Pinecone vector database types

export interface VectorMetadata {
  user_id: string;
  file_id: string;
  chunk_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;  // First 200 chars for display
  source_type: 'file_upload';
  file_type: string;
  created_at: string;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface VectorQueryResponse {
  matches: VectorQueryResult[];
  namespace: string;
}

export interface UpsertVectorRequest {
  vectors: VectorRecord[];
  namespace: string;
}

export interface DeleteVectorRequest {
  ids?: string[];
  deleteAll?: boolean;
  namespace: string;
  filter?: Record<string, string>;
}

// RAG context types
export interface RAGChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    filename: string;
    file_type: string;
    chunk_index: number;
    source_type: 'file_upload' | 'notion' | 'google_drive' | 'github' | 'airtable';
  };
}

export interface RAGContext {
  chunks: RAGChunk[];
  totalTokens: number;
  sources: RAGSource[];
}

export interface RAGSource {
  id: string;
  type: 'file_upload' | 'notion' | 'google_drive' | 'github' | 'airtable';
  name: string;
  url?: string;
  relevanceScore: number;
}

// Citation format for chat responses
export interface Citation {
  id: string;
  source_type: 'file_upload' | 'notion' | 'google_drive' | 'github' | 'airtable';
  source_name: string;
  source_url?: string;
  content_preview: string;
  relevance_score: number;
}


