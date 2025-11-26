import { Pinecone } from '@pinecone-database/pinecone';

// Singleton Pinecone client
let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }

    pineconeClient = new Pinecone({
      apiKey,
    });
  }

  return pineconeClient;
}

export function getPineconeIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME || 'adapt-clone';
  const client = getPineconeClient();
  
  // If a specific host is provided (for pod-based or dedicated indexes), use it
  const indexHost = process.env.PINECONE_INDEX_HOST;
  if (indexHost) {
    return client.index(indexName, indexHost);
  }
  
  return client.index(indexName);
}

// Get index with user namespace for data isolation
export function getPineconeNamespace(userId: string) {
  const index = getPineconeIndex();
  return index.namespace(`user_${userId}`);
}

// Configuration constants
export const PINECONE_CONFIG = {
  indexName: process.env.PINECONE_INDEX_NAME || 'adapt-clone',
  dimension: 1536, // text-embedding-3-small dimension
  metric: 'cosine' as const,
  topK: 5, // Default number of results to return
};

