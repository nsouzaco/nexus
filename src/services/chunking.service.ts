import { ChunkConfig, DEFAULT_CHUNK_CONFIG } from '@/types/files';

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
  metadata?: {
    page?: number;
    section?: string;
  };
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): TextChunk[] {
  const { chunkSize, chunkOverlap, minChunkSize } = config;
  const chunks: TextChunk[] = [];

  // Clean and normalize text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanedText.length === 0) {
    return [];
  }

  // If text is smaller than chunk size, return as single chunk
  if (cleanedText.length <= chunkSize) {
    return [{
      content: cleanedText,
      index: 0,
      startChar: 0,
      endChar: cleanedText.length,
    }];
  }

  // Split by paragraphs first for semantic boundaries
  const paragraphs = cleanedText.split(/\n\n+/);
  let currentChunk = '';
  let currentStartChar = 0;
  let charPosition = 0;

  for (const paragraph of paragraphs) {
    const paragraphWithBreak = paragraph + '\n\n';
    
    // If adding this paragraph exceeds chunk size
    if (currentChunk.length + paragraphWithBreak.length > chunkSize) {
      // Save current chunk if it meets minimum size
      if (currentChunk.length >= minChunkSize) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          startChar: currentStartChar,
          endChar: charPosition,
        });
      }

      // Handle overlap - take end of previous chunk
      if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + paragraphWithBreak;
        currentStartChar = charPosition - chunkOverlap;
      } else {
        currentChunk = paragraphWithBreak;
        currentStartChar = charPosition;
      }

      // If single paragraph is larger than chunk size, split by sentences
      if (paragraph.length > chunkSize) {
        const sentenceChunks = chunkBySentences(paragraph, config);
        for (const sentenceChunk of sentenceChunks) {
          chunks.push({
            content: sentenceChunk.content,
            index: chunks.length,
            startChar: currentStartChar + sentenceChunk.startChar,
            endChar: currentStartChar + sentenceChunk.endChar,
          });
        }
        currentChunk = '';
        currentStartChar = charPosition + paragraph.length;
      }
    } else {
      currentChunk += paragraphWithBreak;
    }

    charPosition += paragraphWithBreak.length;
  }

  // Add remaining chunk
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      startChar: currentStartChar,
      endChar: cleanedText.length,
    });
  }

  return chunks;
}

/**
 * Split text by sentences when paragraphs are too large
 */
function chunkBySentences(
  text: string,
  config: ChunkConfig
): TextChunk[] {
  const { chunkSize, chunkOverlap, minChunkSize } = config;
  const chunks: TextChunk[] = [];

  // Split by sentence endings
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';
  let currentStartChar = 0;
  let charPosition = 0;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      if (currentChunk.length >= minChunkSize) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          startChar: currentStartChar,
          endChar: charPosition,
        });
      }

      // Handle overlap
      if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + sentence;
        currentStartChar = charPosition - chunkOverlap;
      } else {
        currentChunk = sentence;
        currentStartChar = charPosition;
      }
    } else {
      currentChunk += sentence;
    }

    charPosition += sentence.length;
  }

  // Add remaining chunk
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      startChar: currentStartChar,
      endChar: text.length,
    });
  }

  return chunks;
}

/**
 * Chunk CSV data - each row becomes a chunk with context
 */
export function chunkCSV(
  headers: string[],
  rows: string[][],
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const headerLine = headers.join(' | ');

  for (let i = 0; i < rows.length; i++) {
    const rowContent = rows[i].map((cell, idx) => `${headers[idx]}: ${cell}`).join('\n');
    const chunkContent = `Headers: ${headerLine}\n\nRow ${i + 1}:\n${rowContent}`;

    // Group rows if they're small
    if (chunkContent.length < config.minChunkSize && i < rows.length - 1) {
      continue; // Will be grouped with next
    }

    chunks.push({
      content: chunkContent,
      index: chunks.length,
      startChar: i,
      endChar: i + 1,
      metadata: {
        section: `Row ${i + 1}`,
      },
    });
  }

  return chunks;
}

/**
 * Chunk JSON data - convert to readable text first
 */
export function chunkJSON(
  data: unknown,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): TextChunk[] {
  // Convert JSON to readable text format
  const text = JSON.stringify(data, null, 2);
  return chunkText(text, config);
}

