import mammoth from 'mammoth';
import Papa from 'papaparse';
import { SupportedMimeType, SUPPORTED_FILE_TYPES } from '@/types/files';

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    charCount: number;
  };
  // For CSV, we also return structured data
  structuredData?: {
    headers: string[];
    rows: string[][];
  };
}

/**
 * Parse document content based on file type
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: SupportedMimeType,
  filename: string
): Promise<ParsedDocument> {
  const fileConfig = SUPPORTED_FILE_TYPES[mimeType];

  switch (fileConfig.parser) {
    case 'pdf-parse':
      return parsePDF(buffer);
    case 'mammoth':
      return parseWord(buffer);
    case 'papaparse':
      return parseCSV(buffer);
    case 'native':
      return parseText(buffer, mimeType);
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Parse PDF document
 */
async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  // Dynamic import - pdf-parse v2 API
  const { PDFParse } = await import('pdf-parse');
  
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const info = await parser.getInfo() as Record<string, unknown>;
  await parser.destroy();

  return {
    text: result.text,
    metadata: {
      pageCount: typeof info.numPages === 'number' ? info.numPages : undefined,
      wordCount: result.text.split(/\s+/).filter(Boolean).length,
      charCount: result.text.length,
    },
  };
}

/**
 * Parse Word document (.docx)
 */
async function parseWord(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length,
    },
  };
}

/**
 * Parse CSV file
 */
async function parseCSV(buffer: Buffer): Promise<ParsedDocument> {
  const csvString = buffer.toString('utf-8');
  const result = Papa.parse<string[]>(csvString, {
    header: false,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  const rows = result.data;
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  // Convert to readable text for embedding
  const textLines = dataRows.map((row, idx) => {
    const rowText = row
      .map((cell, cellIdx) => `${headers[cellIdx] || `Column ${cellIdx + 1}`}: ${cell}`)
      .join(', ');
    return `Row ${idx + 1}: ${rowText}`;
  });

  const text = `CSV Data with columns: ${headers.join(', ')}\n\n${textLines.join('\n')}`;

  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length,
    },
    structuredData: {
      headers,
      rows: dataRows,
    },
  };
}

/**
 * Parse plain text files (txt, md, json)
 */
async function parseText(
  buffer: Buffer,
  mimeType: SupportedMimeType
): Promise<ParsedDocument> {
  let text = buffer.toString('utf-8');

  // For JSON, pretty print for better readability
  if (mimeType === 'application/json') {
    try {
      const jsonData = JSON.parse(text);
      text = `JSON Document:\n\n${JSON.stringify(jsonData, null, 2)}`;
    } catch {
      // If JSON is invalid, use as-is
      text = `JSON Document (raw):\n\n${text}`;
    }
  }

  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length,
    },
  };
}

/**
 * Validate file can be parsed
 */
export function canParseFile(mimeType: string): boolean {
  return mimeType in SUPPORTED_FILE_TYPES;
}

/**
 * Get file extension from mime type
 */
export function getExtensionFromMimeType(mimeType: SupportedMimeType): string {
  return SUPPORTED_FILE_TYPES[mimeType].extension;
}

