import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { retrieveContext, buildContextString, buildRAGSystemPrompt } from '@/services/rag.service';
import { searchIntegrations, buildIntegrationContextString, getConnectedIntegrations, IntegrationResult } from '@/services/integrations';
import { RAGContext, RAGSource, RAGChunk } from '@/types/pinecone';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Check if the query is a casual/greeting message that doesn't need data sources
 */
function isCasualMessage(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Short greetings
  const casualPatterns = [
    /^(hi|hey|hello|howdy|sup|yo|hola|greetings)[\s!.,?]*$/i,
    /^(good\s*(morning|afternoon|evening|night))[\s!.,?]*$/i,
    /^(how\s*(are\s+you|is\s+it\s+going|do\s+you\s+do))[\s!.,?]*$/i,
    /^(what'?s\s+up|wassup|whats\s+up)[\s!.,?]*$/i,
    /^(thanks?|thank\s+you|thx|ty)[\s!.,?]*$/i,
    /^(ok|okay|sure|got\s+it|understood|cool|great|nice|awesome)[\s!.,?]*$/i,
    /^(bye|goodbye|see\s+you|later|cya)[\s!.,?]*$/i,
    /^(yes|no|yep|nope|yeah|nah)[\s!.,?]*$/i,
    /^(help|can\s+you\s+help)[\s!.,?]*$/i,
    /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do)[\s!.,?]*$/i,
  ];
  
  // Check if it matches any casual pattern
  if (casualPatterns.some(pattern => pattern.test(normalizedQuery))) {
    return true;
  }
  
  // Very short messages without information keywords are likely casual
  if (normalizedQuery.length < 15 && !hasInformationIntent(normalizedQuery)) {
    return true;
  }
  
  return false;
}

/**
 * Check if the query has intent to retrieve information
 */
function hasInformationIntent(query: string): boolean {
  const infoKeywords = [
    'show', 'list', 'find', 'get', 'what', 'who', 'where', 'when', 'why', 'how',
    'tell', 'give', 'search', 'look', 'fetch', 'retrieve',
    'revenue', 'sales', 'data', 'report', 'project', 'task', 'file', 'document',
    'status', 'update', 'progress', 'metric', 'number', 'count', 'total',
    'chart', 'graph', 'plot', 'visualize', 'analyze', 'summary', 'summarize',
    '2023', '2024', '2025', 'q1', 'q2', 'q3', 'q4', 'quarter', 'month', 'year',
  ];
  
  const normalizedQuery = query.toLowerCase();
  return infoKeywords.some(keyword => normalizedQuery.includes(keyword));
}

/**
 * Detect if user is requesting data from a specific source
 * Returns the source type if specified, or null if not specified
 */
function detectRequestedSource(query: string): 'airtable' | 'notion' | 'google_drive' | 'github' | 'file_upload' | null {
  const normalizedQuery = query.toLowerCase();
  
  // Check for explicit source mentions
  const sourcePatterns: Array<{ pattern: RegExp; source: 'airtable' | 'notion' | 'google_drive' | 'github' | 'file_upload' }> = [
    // Airtable patterns
    { pattern: /\b(from|in|using|via)\s+(my\s+)?airtable\b/i, source: 'airtable' },
    { pattern: /\bairtable\s+(data|base|table|records?)\b/i, source: 'airtable' },
    
    // Notion patterns
    { pattern: /\b(from|in|using|via)\s+(my\s+)?notion\b/i, source: 'notion' },
    { pattern: /\bnotion\s+(page|database|doc)/i, source: 'notion' },
    
    // Google Drive patterns
    { pattern: /\b(from|in|using|via)\s+(my\s+)?(google\s+)?drive\b/i, source: 'google_drive' },
    
    // GitHub patterns
    { pattern: /\b(from|in|using|via)\s+(my\s+)?github\b/i, source: 'github' },
    { pattern: /\bgithub\s+(repo|repository|code|issue)/i, source: 'github' },
    { pattern: /\b(my\s+)?repos?\b/i, source: 'github' },
    { pattern: /\b(my\s+)?repositories\b/i, source: 'github' },
    
    // File upload patterns - expanded to catch more cases
    { pattern: /\b(from|in)\s+(my\s+)?(uploaded\s+)?files?\b/i, source: 'file_upload' },
    { pattern: /\b(from|in)\s+(the\s+)?document/i, source: 'file_upload' },
    { pattern: /\bwhat\s+(files?|documents?)\s+(have\s+i|did\s+i|i\s+have)/i, source: 'file_upload' },
    { pattern: /\b(my|the)\s+(uploaded\s+)?files?\b/i, source: 'file_upload' },
    { pattern: /\bfiles?\s+(i('ve)?\s+)?upload(ed)?\b/i, source: 'file_upload' },
    { pattern: /\buploaded?\s+(files?|documents?)\b/i, source: 'file_upload' },
    { pattern: /\b(list|show|what('s|'re)?)\s+(my\s+)?(uploaded\s+)?files?\b/i, source: 'file_upload' },
  ];
  
  for (const { pattern, source } of sourcePatterns) {
    if (pattern.test(normalizedQuery)) {
      return source;
    }
  }
  
  return null;
}

// Minimum relevance score threshold for including sources
const MIN_RELEVANCE_THRESHOLD = 0.65;

/**
 * Detect if the query is a "list query" where sources would be redundant
 * For example: "what are my repos?", "list my files", "show my projects"
 * In these cases, the response IS the list - no need to cite sources
 */
function isListQuery(query: string): boolean {
  const listPatterns = [
    // "What are my X" patterns
    /\bwhat\s+(are|is)\s+(my|the)\s+\w+\s*\??$/i,
    // "List/show my X" patterns  
    /\b(list|show|display)\s+(my|all|the)\s+\w+\s*\??$/i,
    // "What X do I have" patterns
    /\bwhat\s+\w+\s+(do\s+i\s+have|have\s+i)\s*\??$/i,
    // "My X" as a question
    /^(my|all\s+my)\s+\w+\s*\??$/i,
    // "What files/repos/projects have I uploaded/created"
    /\bwhat\s+(files?|repos?|repositories|projects?|documents?|bases?)\b.*\??\s*$/i,
    // "Show me my X"
    /\bshow\s+me\s+(my|all|the)\s+\w+/i,
    // "Get my X"
    /\bget\s+(my|all)\s+\w+/i,
  ];
  
  const normalizedQuery = query.toLowerCase().trim();
  return listPatterns.some(pattern => pattern.test(normalizedQuery));
}

/**
 * Deduplicate and consolidate sources - group by base/table for Airtable, by source for others
 * Filters out irrelevant sources based on threshold and requested source
 */
function consolidateSources(
  ragSources: Array<{ name: string; relevanceScore: number }>,
  integrationResults: IntegrationResult[],
  requestedSource: 'airtable' | 'notion' | 'google_drive' | 'github' | 'file_upload' | null
): Array<{ type: string; name: string; url?: string; relevance: number }> {
  const consolidatedMap = new Map<string, { type: string; name: string; url?: string; relevance: number; count: number }>();
  
  // If user requested a specific source, check if we have results from it
  const hasRequestedSourceResults = requestedSource === null || 
    (requestedSource === 'file_upload' && ragSources.length > 0) ||
    (requestedSource !== 'file_upload' && integrationResults.some(r => r.source === requestedSource));
  
  // Add file sources (only if relevant and not filtered out by requested source)
  for (const source of ragSources) {
    // Skip if user explicitly requested a different source type
    if (requestedSource !== null && requestedSource !== 'file_upload' && hasRequestedSourceResults) {
      continue;
    }
    
    // Skip if below relevance threshold
    if (source.relevanceScore < MIN_RELEVANCE_THRESHOLD) {
      console.log(`Filtering out low-relevance file source: ${source.name} (score: ${source.relevanceScore})`);
      continue;
    }
    
    const key = `file:${source.name}`;
    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        type: 'file_upload',
        name: source.name,
        relevance: source.relevanceScore,
        count: 1,
      });
    }
  }
  
  // Group integration results by source + base/table name
  for (const result of integrationResults) {
    // Skip if user explicitly requested a different source type
    if (requestedSource !== null && requestedSource !== result.source && hasRequestedSourceResults) {
      continue;
    }
    
    let key: string;
    let displayName: string;
    let url: string | undefined;
    
    if (result.source === 'airtable') {
      // For Airtable, group by base name (extracted from title like "Project Central / Revenue")
      const baseName = result.title.split(' / ')[0] || result.title;
      key = `airtable:${baseName}`;
      displayName = baseName;
      // Use the base URL (not the record URL)
      url = result.url.split('/').slice(0, 4).join('/');
    } else {
      // For other sources, use the full title
      key = `${result.source}:${result.title}`;
      displayName = result.title;
      url = result.url;
    }
    
    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        type: result.source,
        name: displayName,
        url,
        relevance: 1,
        count: 1,
      });
    } else {
      // Increment count for this source (more records = more relevance)
      const existing = consolidatedMap.get(key)!;
      existing.count++;
      existing.relevance = Math.min(1, existing.relevance + 0.1);
    }
  }
  
  // Convert to array and sort by relevance
  return Array.from(consolidatedMap.values())
    .sort((a, b) => b.relevance - a.relevance)
    .map(({ type, name, url, relevance }) => ({ type, name, url, relevance }));
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, conversationId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        );
      }
      currentConversationId = newConversation.id;
    }

    // Save user message
    const { error: userMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: message,
      });

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
    }

    // Get conversation history for context
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', currentConversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Check if this is a casual message that doesn't need data sources
    const isCasual = isCasualMessage(message);
    
    // Only retrieve context for informational queries
    let ragContext: RAGContext = { chunks: [] as RAGChunk[], totalTokens: 0, sources: [] as RAGSource[] };
    let integrationContext = { results: [] as IntegrationResult[], connectedIntegrations: [] as string[] };
    
    if (!isCasual) {
      // Retrieve context from both sources in parallel
      [ragContext, integrationContext] = await Promise.all([
        retrieveContext(user.id, message).catch(err => {
          console.error('RAG context error:', err);
          return { chunks: [], totalTokens: 0, sources: [] };
        }),
        searchIntegrations(user.id, message, 15).catch(err => {
          console.error('Integration search error:', err);
          return { results: [], connectedIntegrations: [] };
        }),
      ]);

      // Log what we found
      console.log('Connected integrations:', integrationContext.connectedIntegrations);
      console.log('Integration results count:', integrationContext.results.length);
      console.log('RAG chunks count:', ragContext.chunks.length);
    } else {
      console.log('Casual message detected, skipping data retrieval');
      // Still get connected integrations for context
      integrationContext.connectedIntegrations = await getConnectedIntegrations(user.id);
    }

    // Build context strings
    const fileContextString = buildContextString(ragContext);
    const integrationContextString = buildIntegrationContextString(integrationContext);
    
    if (!isCasual) {
      console.log('Integration context preview:', integrationContextString.slice(0, 500));
    }
    
    // Build system prompt with both contexts
    const systemPrompt = buildRAGSystemPrompt(fileContextString, integrationContextString, integrationContext.connectedIntegrations);

    // Build messages array with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (excluding the message we just saved)
    if (history && history.length > 1) {
      const previousMessages = history.slice(0, -1);
      for (const msg of previousMessages) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Call OpenAI with lower temperature for consistent, factual responses
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.2,
      max_tokens: 2000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Detect if user is requesting a specific source
    const requestedSource = detectRequestedSource(message);
    if (requestedSource) {
      console.log(`User requested specific source: ${requestedSource}`);
    }

    // Check if this is a list query (sources would be redundant)
    const isListingQuery = isListQuery(message);
    if (isListingQuery) {
      console.log('List query detected - sources will be omitted as they would be redundant');
    }

    // Build consolidated sources (deduplicated and grouped)
    // Skip sources for casual messages and list queries (where sources are redundant)
    const sources = (isCasual || isListingQuery)
      ? [] 
      : consolidateSources(ragContext.sources, integrationContext.results, requestedSource);

    // Save assistant message
    const { error: assistantMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: assistantMessage,
        sources: sources.length > 0 ? sources : null,
      });

    if (assistantMsgError) {
      console.error('Error saving assistant message:', assistantMsgError);
    }

    return NextResponse.json({
      message: assistantMessage,
      sources,
      conversationId: currentConversationId,
      connectedIntegrations: integrationContext.connectedIntegrations,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

// Get conversations list
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [conversationsResult, connectedIntegrations] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      getConnectedIntegrations(user.id),
    ]);

    if (conversationsResult.error) {
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      conversations: conversationsResult.data,
      connectedIntegrations,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
