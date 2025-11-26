import OpenAI from 'openai';

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_TOKENS_PER_REQUEST = 8191; // Model limit
const BATCH_SIZE = 100; // Max texts per batch request

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens: number;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const client = getOpenAIClient();
  
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage.total_tokens,
  };
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  const client = getOpenAIClient();
  const embeddings: EmbeddingResult[] = [];
  let totalTokens = 0;

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    // Map results to maintain order
    for (let j = 0; j < response.data.length; j++) {
      embeddings.push({
        embedding: response.data[j].embedding,
        tokenCount: Math.ceil(response.usage.total_tokens / batch.length), // Approximate per-text
      });
    }

    totalTokens += response.usage.total_tokens;
  }

  return { embeddings, totalTokens };
}

/**
 * Generate embedding for a search query
 * (Same as generateEmbedding but named for clarity)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const result = await generateEmbedding(query);
  return result.embedding;
}

/**
 * Estimate token count for text (rough approximation)
 * More accurate than counting words, less accurate than tiktoken
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number = MAX_TOKENS_PER_REQUEST): string {
  const estimatedTokens = estimateTokenCount(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Truncate based on character estimate
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars);
}

