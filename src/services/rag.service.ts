import { createClient } from '@/lib/supabase/server';
import { generateQueryEmbedding } from './embedding.service';
import { queryVectors } from './pinecone.service';
import { RAGChunk, RAGContext, Citation } from '@/types/pinecone';

const MAX_CONTEXT_TOKENS = 4000; // Leave room for system prompt and response
const DEFAULT_TOP_K = 5;

/**
 * Retrieve relevant context for a user's query using RAG
 */
export async function retrieveContext(
  userId: string,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<RAGContext> {
  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);

  // Query Pinecone for similar vectors
  const vectorResults = await queryVectors(userId, queryEmbedding, topK);

  if (vectorResults.length === 0) {
    return {
      chunks: [],
      totalTokens: 0,
      sources: [],
    };
  }

  // Fetch full chunk content from database
  const supabase = await createClient();
  const chunkIds = vectorResults.map((r) => r.metadata.chunk_id);

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, metadata, file_id')
    .in('id', chunkIds)
    .eq('user_id', userId);

  if (error || !chunks) {
    console.error('Error fetching chunks:', error);
    return {
      chunks: [],
      totalTokens: 0,
      sources: [],
    };
  }

  // Build RAG chunks with scores
  const ragChunks: RAGChunk[] = chunks.map((chunk) => {
    const vectorResult = vectorResults.find((r) => r.metadata.chunk_id === chunk.id);
    const metadata = chunk.metadata as {
      filename?: string;
      file_type?: string;
      chunk_index?: number;
    } | null;

    return {
      id: chunk.id,
      content: chunk.content,
      score: vectorResult?.score || 0,
      metadata: {
        filename: metadata?.filename || 'Unknown',
        file_type: metadata?.file_type || 'unknown',
        chunk_index: metadata?.chunk_index || 0,
        source_type: 'file_upload' as const,
      },
    };
  });

  // Sort by score descending
  ragChunks.sort((a, b) => b.score - a.score);

  // Calculate total tokens (rough estimate)
  let totalTokens = 0;
  const includedChunks: RAGChunk[] = [];

  for (const chunk of ragChunks) {
    const chunkTokens = Math.ceil(chunk.content.length / 4);
    if (totalTokens + chunkTokens > MAX_CONTEXT_TOKENS) {
      break;
    }
    includedChunks.push(chunk);
    totalTokens += chunkTokens;
  }

  // Extract unique sources
  const sourceMap = new Map<string, { filename: string; score: number }>();
  for (const chunk of includedChunks) {
    const existing = sourceMap.get(chunk.metadata.filename);
    if (!existing || existing.score < chunk.score) {
      sourceMap.set(chunk.metadata.filename, {
        filename: chunk.metadata.filename,
        score: chunk.score,
      });
    }
  }

  const sources = Array.from(sourceMap.entries()).map(([filename, data]) => ({
    id: filename,
    type: 'file_upload' as const,
    name: filename,
    relevanceScore: data.score,
  }));

  return {
    chunks: includedChunks,
    totalTokens,
    sources,
  };
}

/**
 * Build context string for LLM prompt
 */
export function buildContextString(context: RAGContext): string {
  if (context.chunks.length === 0) {
    return 'No relevant documents found in uploaded files.';
  }

  const contextParts = context.chunks.map((chunk, index) => {
    return `[Source ${index + 1}: ${chunk.metadata.filename}]\n${chunk.content}`;
  });

  return contextParts.join('\n\n---\n\n');
}

/**
 * Build citations array from RAG context
 */
export function buildCitations(context: RAGContext): Citation[] {
  return context.chunks.map((chunk) => ({
    id: chunk.id,
    source_type: 'file_upload',
    source_name: chunk.metadata.filename,
    content_preview: chunk.content.slice(0, 150) + (chunk.content.length > 150 ? '...' : ''),
    relevance_score: chunk.score,
  }));
}

/**
 * Build system prompt with RAG context
 */
export function buildRAGSystemPrompt(fileContext: string, integrationContext?: string): string {
  let prompt = `You are an AI assistant helping users find information from their uploaded documents and connected integrations.

INSTRUCTIONS:
1. Answer the user's question using ONLY the provided context
2. Always cite your sources using [Source: filename] format
3. If information is not in the context, say so clearly
4. Be concise but thorough
5. If multiple sources contain relevant information, synthesize them

`;

  if (fileContext && fileContext !== 'No relevant documents found in uploaded files.') {
    prompt += `CONTEXT FROM UPLOADED FILES:
${fileContext}

`;
  }

  if (integrationContext) {
    prompt += `CONTEXT FROM INTEGRATIONS:
${integrationContext}

`;
  }

  if (!fileContext && !integrationContext) {
    prompt += `No context available from uploaded files or integrations. Let the user know they should upload documents or connect integrations to get answers from their data.

`;
  }

  prompt += `CITATION FORMAT:
- For uploaded files: [Source: filename.pdf]
- For Notion: [Source: Notion - Page Title]
- For Google Drive: [Source: Drive - Document Name]
- For GitHub: [Source: GitHub - repo/path]
- For Airtable: [Source: Airtable - Base/Table]`;

  return prompt;
}

/**
 * Check if user has any indexed files
 */
export async function hasIndexedFiles(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('files')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'ready');

  if (error) {
    return false;
  }

  return (count || 0) > 0;
}

