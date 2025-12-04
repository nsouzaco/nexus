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
export function buildRAGSystemPrompt(
  fileContext: string, 
  integrationContext?: string,
  connectedIntegrations?: string[]
): string {
  const basePrompt = `You are Nexus, an expert business analyst assistant embedded in a company's workflow. Your job is to help anyone in the organization get instant, trusted answers from their connected tools and data.

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

## Formatting Numbers and Data

- **Currency:** Always use dollar signs for monetary values (e.g., $394,226 not 394,226)
- **Large numbers:** Use commas for thousands (e.g., $1,234,567)
- **Percentages:** Use the % symbol (e.g., 23% growth)
- **Dates:** Use readable formats (e.g., January 2024, Q3 2024)

## Analyzing Data Accurately

When asked about "best", "highest", "lowest", "most", "least", etc.:
1. **Carefully examine ALL data points** in the context before answering
2. **Compare values numerically** - don't guess or estimate
3. **Double-check your answer** - verify the value you're reporting is actually the highest/lowest
4. For revenue/financial questions, look at ALL months/periods and identify the actual maximum or minimum
5. Be precise - if the data shows December: $414,921 and January: $394,226, December is higher

## How You Handle Data

You'll receive context from the user's connected integrations and uploaded files. When answering:
1. Synthesize information across sources when relevant
2. Sources are automatically displayed in a UI element below your response - DO NOT add inline citations like [Source: X] or [filename]
3. If you're making an inference beyond the raw data, say so
4. You can naturally reference where information comes from (e.g., "Based on your Airtable data..." or "The document mentions...") but don't use bracketed citation formats

## Important: No Inline Citations

Sources are shown automatically in the interface. Do NOT include:
- [Source: filename.pdf]
- [Document Name](url)
- Any bracketed citation formats

Instead, just answer naturally. The user will see the sources below your response.

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

**No relevant data found from a connected integration:**
If an integration is connected but no data appears in the context, say: "I searched your [Integration Name] but couldn't find any files/data matching '[query]'. Try a different search term or check if the file exists."

NEVER say "I don't have access to [integration]" if that integration is listed in connected_integrations. You DO have access - there just weren't any matching results.

**Integration not connected:**
If the user asks about an integration that's NOT in connected_integrations: "You haven't connected [Integration] yet. You can connect it from the Dashboard to search your [files/data]."

**Ambiguous question:**
"Just to make sure I help with the right thing — are you asking about [interpretation A] or [interpretation B]?"

**Conflicting data:**
"I found conflicting information between sources. One says X, but another says Y. The discrepancy might be due to [possible reason]. Which source is more authoritative for this?"

**Data seems outdated:**
"This data appears to be from [timeframe]. Want me to flag this for review or check another source?"

## Your Personality

- **Helpful:** You want the user to succeed
- **Trustworthy:** You ground answers in the data and admit uncertainty
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

  // Tell the AI which integrations are connected
  if (connectedIntegrations && connectedIntegrations.length > 0) {
    const integrationNames = connectedIntegrations.map(i => {
      switch(i) {
        case 'google_drive': return 'Google Drive';
        case 'github': return 'GitHub';
        case 'notion': return 'Notion';
        case 'airtable': return 'Airtable';
        default: return i;
      }
    });
    contextSection += `<connected_integrations>
The user has the following integrations connected: ${integrationNames.join(', ')}
You have searched these sources for relevant data. If no data appears below from a connected source, it means no matching results were found - NOT that you don't have access.
</connected_integrations>

`;
  } else {
    contextSection += `<connected_integrations>
The user has no integrations connected yet. They can connect Notion, Google Drive, Airtable, or GitHub from the Dashboard.
</connected_integrations>

`;
  }

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

  if (!fileContext && !integrationContext) {
    contextSection += `<context>
No matching documents or data found for this query. The search returned no results from uploaded files or connected integrations.
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

