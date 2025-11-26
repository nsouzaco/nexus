# Phase 2: Pinecone RAG for File Upload — Implementation Plan

## Overview

Add the ability for users to upload documents directly to Adapt Clone, process them into vector embeddings, store in Pinecone, and use RAG (Retrieval Augmented Generation) to answer questions with context from uploaded files.

**Goal:** Enable users to upload PDFs, Word docs, text files, and other documents that become searchable alongside their connected integrations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Next.js App                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  New Components                    │  New API Routes                         │
│  ├── FileUpload                    │  ├── /api/files/upload                 │
│  ├── FileList                      │  ├── /api/files/[id]/delete            │
│  ├── UploadProgress                │  ├── /api/files/process                │
│  └── DocumentCard                  │  └── /api/chat (updated)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Services Layer                                     │
│  ├── FileService          (upload, delete, list)                            │
│  ├── EmbeddingService     (OpenAI text-embedding-3-small)                   │
│  ├── ChunkingService      (document splitting)                              │
│  ├── PineconeService      (vector CRUD operations)                          │
│  └── RAGService           (retrieval + context building)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Data Layer                                      │
│  ├── Supabase Storage     (raw file storage)                                │
│  ├── Supabase DB          (file metadata, chunks table)                     │
│  └── Pinecone             (vector embeddings)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: File Upload → RAG Query

```
1. UPLOAD FLOW
   User uploads file → Supabase Storage → 
   Extract text → Chunk document → 
   Generate embeddings (OpenAI) → 
   Store vectors (Pinecone) → 
   Store metadata (Supabase)

2. QUERY FLOW (RAG)
   User asks question → 
   Generate query embedding → 
   Search Pinecone (similarity) → 
   Retrieve top-k chunks → 
   Combine with integration context → 
   Send to OpenAI with system prompt → 
   Stream response with citations
```

---

## Database Schema Updates

### New Tables for Supabase

```sql
-- File uploads metadata
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks (for reference, vectors stored in Pinecone)
CREATE TABLE chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  pinecone_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own files" ON files
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access own chunks" ON chunks
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_chunks_file_id ON chunks(file_id);
CREATE INDEX idx_chunks_user_id ON chunks(user_id);
```

### Supabase Storage Bucket

```sql
-- Create storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false);

-- Storage policy: users can only access their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Pinecone Setup

### Index Configuration

```typescript
// Pinecone index configuration
const indexConfig = {
  name: 'adapt-clone',
  dimension: 1536,  // text-embedding-3-small dimension
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
};

// Vector metadata schema
interface VectorMetadata {
  user_id: string;
  file_id: string;
  chunk_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;  // First 200 chars for display
  source_type: 'file_upload';
}
```

### Namespace Strategy

Use user_id as namespace to ensure data isolation:
```typescript
// Each user's vectors in their own namespace
const namespace = `user_${userId}`;
await index.namespace(namespace).upsert(vectors);
await index.namespace(namespace).query(queryVector);
```

---

## New Environment Variables

```bash
# Pinecone (SDK v2+ - serverless indexes only need API key)
PINECONE_API_KEY=<pinecone_api_key>
PINECONE_INDEX_NAME=adapt-clone
# Optional: Only needed for pod-based indexes (not serverless)
PINECONE_INDEX_HOST=<e.g. https://adapt-clone-xxxxx.svc.us-east-1.pinecone.io>

# OpenAI (already exists, used for embeddings too)
OPENAI_API_KEY=<already_configured>
```

**Note:** Pinecone SDK v2+ automatically routes to the correct endpoint using your API key. You only need `PINECONE_INDEX_HOST` if you're using a pod-based index instead of serverless.

---

## Implementation Tasks

### Phase 2.1: Infrastructure Setup
- [ ] Create Pinecone account and index
- [ ] Add Pinecone SDK dependency (`@pinecone-database/pinecone`)
- [ ] Create Pinecone client utility (`src/lib/pinecone/client.ts`)
- [ ] Run database migration for `files` and `chunks` tables
- [ ] Create Supabase storage bucket

### Phase 2.2: File Upload System
- [ ] Create FileUpload component with drag-and-drop
- [ ] Create file upload API route (`/api/files/upload`)
- [ ] Implement file validation (type, size limits)
- [ ] Create FileService for upload management
- [ ] Store files in Supabase Storage
- [ ] Create FileList component to display uploads
- [ ] Create DocumentCard component for individual files
- [ ] Add file deletion endpoint and UI

### Phase 2.3: Document Processing Pipeline
- [ ] Install document parsing libraries
  - `pdf-parse` for PDFs
  - `mammoth` for Word docs
  - `papaparse` for CSV files
- [ ] Create ChunkingService with configurable chunk size
- [ ] Create EmbeddingService using OpenAI
- [ ] Create document processing API route (`/api/files/process`)
- [ ] Implement background processing queue (or use Supabase Edge Functions)
- [ ] Add processing status updates and error handling

### Phase 2.4: Pinecone Integration
- [ ] Create PineconeService for vector operations
- [ ] Implement vector upsert after embedding generation
- [ ] Implement vector deletion when file is deleted
- [ ] Add query method for similarity search
- [ ] Test namespace isolation between users

### Phase 2.5: RAG Integration
- [ ] Create RAGService to orchestrate retrieval
- [ ] Update chat API to include RAG context
- [ ] Implement context ranking (combine file + integration sources)
- [ ] Add citation format for uploaded files
- [ ] Update ChatMessage to display file citations
- [ ] Test end-to-end RAG flow

### Phase 2.6: UI Enhancements
- [ ] Add "Files" tab to dashboard
- [ ] Create upload progress indicator
- [ ] Show processing status (pending/processing/ready/failed)
- [ ] Add file preview capability
- [ ] Implement batch upload support
- [ ] Add storage usage display

---

## File Structure (New Files)

```
src/
├── app/
│   └── api/
│       └── files/
│           ├── upload/
│           │   └── route.ts       # Handle file uploads
│           ├── process/
│           │   └── route.ts       # Process files into chunks
│           └── [id]/
│               └── route.ts       # Get/delete specific file
├── components/
│   └── features/
│       ├── file-upload.tsx        # Drag-and-drop upload
│       ├── file-list.tsx          # List of uploaded files
│       ├── document-card.tsx      # Individual file card
│       └── upload-progress.tsx    # Upload progress indicator
├── lib/
│   └── pinecone/
│       └── client.ts              # Pinecone client setup
├── services/
│   ├── file.service.ts            # File CRUD operations
│   ├── chunking.service.ts        # Document chunking logic
│   ├── embedding.service.ts       # OpenAI embeddings
│   ├── pinecone.service.ts        # Pinecone vector ops
│   └── rag.service.ts             # RAG orchestration
└── types/
    ├── files.ts                   # File-related types
    └── pinecone.ts                # Pinecone-related types
```

---

## Supported File Types

| Type | Extension | Library | Notes |
|------|-----------|---------|-------|
| PDF | .pdf | pdf-parse | Most common document type |
| Word | .docx | mammoth | Microsoft Word documents |
| Text | .txt, .md | native | Plain text files |
| CSV | .csv | papaparse | Structured data |
| JSON | .json | native | Configuration/data files |

### Future Considerations
- Excel files (.xlsx) - requires `xlsx` library
- PowerPoint (.pptx) - requires `pptx` library
- Images with OCR - requires Tesseract or cloud OCR

---

## Chunking Strategy

```typescript
interface ChunkConfig {
  chunkSize: number;      // Target chunk size in tokens (default: 500)
  chunkOverlap: number;   // Overlap between chunks (default: 50)
  separator: string;      // Text split separator
}

// Chunking approach
1. Split by paragraphs/sections first (semantic boundaries)
2. If chunk > chunkSize, split by sentences
3. If sentence > chunkSize, split by tokens
4. Add overlap to maintain context continuity
```

---

## RAG Query Flow

```typescript
async function ragQuery(userId: string, question: string): Promise<RAGResult> {
  // 1. Generate embedding for the question
  const queryEmbedding = await embeddingService.embed(question);
  
  // 2. Query Pinecone for relevant chunks
  const pineconeResults = await pineconeService.query({
    namespace: `user_${userId}`,
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true
  });
  
  // 3. Fetch full chunk content from Supabase
  const chunks = await getChunksByIds(pineconeResults.map(r => r.metadata.chunk_id));
  
  // 4. Build context string with citations
  const context = buildContextWithCitations(chunks);
  
  // 5. Also retrieve from connected integrations (existing flow)
  const integrationContext = await getIntegrationContext(userId, question);
  
  // 6. Combine contexts and send to OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildSystemPrompt(context, integrationContext) },
      { role: 'user', content: question }
    ],
    stream: true
  });
  
  return {
    response,
    sources: [...chunks, ...integrationContext.sources]
  };
}
```

---

## System Prompt Update

```typescript
const systemPrompt = `You are an AI assistant helping users find information from their uploaded documents and connected integrations.

CONTEXT FROM UPLOADED FILES:
${fileContext}

CONTEXT FROM INTEGRATIONS:
${integrationContext}

INSTRUCTIONS:
1. Answer the user's question using ONLY the provided context
2. Always cite your sources using [Source: filename] format
3. If information is not in the context, say so clearly
4. Prioritize recent and relevant information
5. Be concise but thorough

FORMAT CITATIONS:
- For uploaded files: [Source: filename.pdf, p.X]
- For Notion: [Source: Notion - Page Title]
- For Google Drive: [Source: Drive - Document Name]
- For GitHub: [Source: GitHub - repo/path]
- For Airtable: [Source: Airtable - Base/Table]
`;
```

---

## API Endpoints

### POST /api/files/upload
```typescript
// Request: multipart/form-data with file
// Response:
{
  id: string;
  filename: string;
  status: 'pending';
  message: 'File uploaded, processing will begin shortly';
}
```

### POST /api/files/process
```typescript
// Request:
{ fileId: string }

// Response (streaming progress):
{ status: 'extracting' | 'chunking' | 'embedding' | 'complete'; progress: number }
```

### GET /api/files
```typescript
// Response:
{
  files: Array<{
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    chunk_count: number;
    created_at: string;
  }>
}
```

### DELETE /api/files/[id]
```typescript
// Response:
{ success: true; message: 'File and vectors deleted' }
```

---

## Cost Considerations

| Operation | Cost | Notes |
|-----------|------|-------|
| OpenAI Embeddings | ~$0.02 / 1M tokens | text-embedding-3-small |
| Pinecone | Free tier: 1 index, 100K vectors | Starter plan: $70/mo |
| Supabase Storage | 1GB free, then $0.021/GB | Per project |

### Optimization Strategies
- Batch embedding requests (up to 2048 inputs)
- Compress vectors for storage efficiency
- Implement file size limits (e.g., 10MB max)
- Cache frequently accessed embeddings

---

## Security Considerations

1. **File Validation**
   - Validate file types server-side
   - Scan for malware (optional: VirusTotal API)
   - Limit file sizes

2. **Data Isolation**
   - Pinecone namespaces per user
   - RLS policies on all tables
   - Storage bucket policies

3. **Access Control**
   - Verify user owns file before operations
   - Signed URLs for file downloads
   - Rate limiting on upload endpoints

---

## Testing Plan

### Unit Tests
- [ ] ChunkingService with various document types
- [ ] EmbeddingService batch processing
- [ ] PineconeService CRUD operations
- [ ] RAGService context building

### Integration Tests
- [ ] Full upload → process → query flow
- [ ] File deletion cascades (storage + vectors)
- [ ] User isolation (can't access other users' files)

### E2E Tests
- [ ] Upload PDF and ask questions
- [ ] Combined query (files + integrations)
- [ ] Error handling (corrupt file, large file)

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 2.1 Infrastructure | 1-2 days | Pinecone account |
| 2.2 File Upload | 2-3 days | Phase 2.1 |
| 2.3 Processing | 2-3 days | Phase 2.2 |
| 2.4 Pinecone Integration | 1-2 days | Phase 2.3 |
| 2.5 RAG Integration | 2-3 days | Phase 2.4 |
| 2.6 UI Enhancements | 1-2 days | Phase 2.5 |

**Total: 9-15 days**

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@pinecone-database/pinecone": "^2.0.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.1",
    "@types/papaparse": "^5.3.14"
  }
}
```

---

## Success Criteria

Phase 2 is complete when:
1. ✅ User can upload PDF, Word, and text files
2. ✅ Files are processed and chunked automatically
3. ✅ Vectors are stored in Pinecone with proper isolation
4. ✅ Chat queries include context from uploaded files
5. ✅ Citations correctly reference uploaded documents
6. ✅ Users can delete files (cascades to vectors)
7. ✅ Dashboard shows upload status and file list

---

## Future Enhancements (Phase 3+)

- [ ] OCR for scanned PDFs and images
- [ ] Real-time processing status via WebSockets
- [ ] Folder organization for files
- [ ] File sharing between team members
- [ ] Automatic re-indexing when files are updated
- [ ] Semantic search UI for browsing chunks
- [ ] File versioning

