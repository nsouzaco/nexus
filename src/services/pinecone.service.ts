import { getPineconeNamespace, PINECONE_CONFIG } from '@/lib/pinecone/client';
import { VectorMetadata, VectorRecord, VectorQueryResult } from '@/types/pinecone';

/**
 * Upsert vectors to Pinecone for a specific user
 */
export async function upsertVectors(
  userId: string,
  vectors: VectorRecord[]
): Promise<void> {
  const namespace = getPineconeNamespace(userId);

  // Pinecone expects vectors in specific format
  const pineconeVectors = vectors.map((v) => ({
    id: v.id,
    values: v.values,
    metadata: v.metadata as unknown as Record<string, string | number | boolean>,
  }));

  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < pineconeVectors.length; i += batchSize) {
    const batch = pineconeVectors.slice(i, i + batchSize);
    await namespace.upsert(batch);
  }
}

/**
 * Query vectors from Pinecone for a specific user
 */
export async function queryVectors(
  userId: string,
  queryVector: number[],
  topK: number = PINECONE_CONFIG.topK,
  filter?: Record<string, string>
): Promise<VectorQueryResult[]> {
  const namespace = getPineconeNamespace(userId);

  const queryResponse = await namespace.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter,
  });

  return (queryResponse.matches || []).map((match) => ({
    id: match.id,
    score: match.score || 0,
    metadata: match.metadata as unknown as VectorMetadata,
  }));
}

/**
 * Delete vectors by IDs for a specific user
 */
export async function deleteVectorsByIds(
  userId: string,
  ids: string[]
): Promise<void> {
  const namespace = getPineconeNamespace(userId);

  // Delete in batches of 1000 (Pinecone limit)
  const batchSize = 1000;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await namespace.deleteMany(batch);
  }
}

/**
 * Delete all vectors for a specific file
 */
export async function deleteVectorsByFileId(
  userId: string,
  fileId: string
): Promise<void> {
  const namespace = getPineconeNamespace(userId);

  // First, query to find all vector IDs for this file
  // We use a dummy vector since we're filtering by metadata
  const dummyVector = new Array(PINECONE_CONFIG.dimension).fill(0);
  
  const results = await namespace.query({
    vector: dummyVector,
    topK: 10000, // Get all vectors for this file
    filter: {
      file_id: fileId,
    },
    includeMetadata: false,
  });

  if (results.matches && results.matches.length > 0) {
    const ids = results.matches.map(m => m.id);
    // Delete by IDs in batches
    const batchSize = 1000;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await namespace.deleteMany(batch);
    }
  }
}

/**
 * Delete all vectors for a user (use with caution!)
 */
export async function deleteAllUserVectors(userId: string): Promise<void> {
  const namespace = getPineconeNamespace(userId);
  await namespace.deleteAll();
}

/**
 * Get vector count for a user's namespace
 */
export async function getVectorCount(userId: string): Promise<number> {
  const namespace = getPineconeNamespace(userId);
  const stats = await namespace.describeIndexStats();
  return stats.namespaces?.[`user_${userId}`]?.recordCount || 0;
}

/**
 * Build vector records from chunks and embeddings
 */
export function buildVectorRecords(
  userId: string,
  fileId: string,
  filename: string,
  fileType: string,
  chunks: Array<{ id: string; content: string; index: number }>,
  embeddings: number[][]
): VectorRecord[] {
  return chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i],
    metadata: {
      user_id: userId,
      file_id: fileId,
      chunk_id: chunk.id,
      filename,
      chunk_index: chunk.index,
      content_preview: chunk.content.slice(0, 200),
      source_type: 'file_upload' as const,
      file_type: fileType,
      created_at: new Date().toISOString(),
    },
  }));
}

