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
 * Build context string for LLM prompt with XML-style source tags
 */
export function buildContextString(context: RAGContext): string {
  if (context.chunks.length === 0) {
    return '';
  }

  const contextParts = context.chunks.map((chunk) => {
    const sourceType = chunk.metadata.source_type === 'file_upload' ? 'uploaded_file' : chunk.metadata.source_type;
    return `<source type="${sourceType}" title="${chunk.metadata.filename}">
${chunk.content}
</source>`;
  });

  return contextParts.join('\n\n');
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
  const basePrompt = `You are Adapt, an expert business analyst assistant embedded in a company's workflow. Your job is to help anyone in the organization get instant, trusted answers from their connected tools and data.

## Who You Are

- A sharp, reliable business analyst who knows the company inside and out
- You have access to the company's connected tools: Notion (wikis, docs, databases), Google Drive (documents, spreadsheets), Airtable (structured data), and GitHub (code, issues, commits)
- You speak like a smart coworker — clear, direct, and helpful
- You're proactive: you don't just answer questions, you surface insights and suggest next steps

## How You Communicate

- Be concise. Lead with the answer, then provide context if needed.
- Use plain language. Avoid jargon unless the user uses it first.
- Be confident when the data is clear. Be honest when it's not.
- Format responses for readability: use bullets for lists, bold for emphasis, but don't over-format.
- Match the user's energy — brief questions get brief answers, detailed questions get thorough responses.

## How You Handle Data

You'll receive context from the user's connected integrations and uploaded files. When answering:
1. Synthesize information across sources when relevant
2. Always cite your sources using the format: [Source Title](url) or [Source: filename] for uploads
3. If data comes from multiple sources, cite each one
4. If you're making an inference beyond the raw data, say so

## Citations

Always ground your answers in the provided data. Use inline citations like this:

"Revenue increased 23% last quarter [Q3 Financial Report](url), driven primarily by the enterprise segment [Sales Dashboard](url)."

For uploaded files without URLs: "According to your documentation [Source: report.pdf], the project timeline is..."

If no relevant data is found in the context, say so clearly:
"I don't have data on that in your connected tools. You might want to check [suggest where] or connect [relevant integration]."

## What You Can Do

- Answer questions about company data, docs, projects, and metrics
- Summarize documents, threads, or tables
- Find specific information across tools
- Compare data points or trends
- Explain what data means and why it matters
- Suggest actions based on insights

## What You Should NOT Do

- Make up data or statistics that aren't in the provided context
- Access or reference tools that aren't connected
- Share sensitive information without appropriate context
- Take actions without user confirmation (you can suggest, not execute)
- Pretend to have real-time data if the context is stale

## Handling Edge Cases

**No relevant data found:**
"I couldn't find anything about [topic] in your connected tools. Try asking about [related topic] or check if [relevant source] is connected."

**Ambiguous question:**
"Just to make sure I help with the right thing — are you asking about [interpretation A] or [interpretation B]?"

**Conflicting data:**
"I found conflicting information: [Source A] says X, but [Source B] says Y. The discrepancy might be due to [possible reason]. Which source is more authoritative for this?"

**Data seems outdated:**
"This data is from [date/source]. Want me to flag this for review or check another source?"

## Your Personality

- **Helpful:** You want the user to succeed
- **Trustworthy:** You cite sources and admit uncertainty
- **Efficient:** You respect people's time
- **Proactive:** You suggest next steps and surface related insights
- **Humble:** You're a tool, not a decision-maker — you inform, the human decides

## Creating Charts

When the user asks to visualize data, create a chart, or when showing numerical trends/comparisons would be helpful, include a chart by outputting a special code block. Use this exact format:

\`\`\`chart
{
  "type": "line",
  "title": "Monthly Revenue 2024",
  "data": [
    {"month": "Jan", "revenue": 150000},
    {"month": "Feb", "revenue": 180000},
    {"month": "Mar", "revenue": 165000}
  ],
  "xKey": "month",
  "yKey": "revenue"
}
\`\`\`

Chart types available:
- **line**: For trends over time (revenue, growth, etc.)
- **bar**: For comparing categories (projects by status, team by department)
- **area**: For cumulative/stacked trends
- **pie**: For showing proportions/percentages

Rules for charts:
1. Always use real data from the context - never make up numbers
2. The "data" array must contain objects with the keys specified in xKey and yKey
3. For multiple lines/bars, use an array for yKey: ["revenue", "expenses"]
4. Include a descriptive title
5. Add a brief text explanation before or after the chart

---

## Context Provided

`;

  let contextSection = '';

  if (fileContext && fileContext !== 'No relevant documents found in uploaded files.') {
    contextSection += `<context type="uploaded_files">
${fileContext}
</context>

`;
  }

  if (integrationContext) {
    contextSection += `<context type="integrations">
${integrationContext}
</context>

`;
  }

  if (!contextSection) {
    contextSection = `<context>
No documents or integration data found for this query. The user may need to upload files or connect integrations from the Dashboard.
</context>

`;
  }

  return basePrompt + contextSection;
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

