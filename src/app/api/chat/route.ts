import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { retrieveContext, buildContextString, buildRAGSystemPrompt } from '@/services/rag.service';
import { searchIntegrations, buildIntegrationContextString, getConnectedIntegrations } from '@/services/integrations';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Retrieve context from both sources in parallel
    const [ragContext, integrationContext] = await Promise.all([
      retrieveContext(user.id, message).catch(err => {
        console.error('RAG context error:', err);
        return { chunks: [], totalTokens: 0, sources: [] };
      }),
      searchIntegrations(user.id, message, 5).catch(err => {
        console.error('Integration search error:', err);
        return { results: [], connectedIntegrations: [] };
      }),
    ]);

    // Log what we found
    console.log('Connected integrations:', integrationContext.connectedIntegrations);
    console.log('Integration results count:', integrationContext.results.length);
    console.log('RAG chunks count:', ragContext.chunks.length);

    // Build context strings
    const fileContextString = buildContextString(ragContext);
    const integrationContextString = buildIntegrationContextString(integrationContext);
    
    console.log('Integration context preview:', integrationContextString.slice(0, 500));
    
    // Build system prompt with both contexts
    const systemPrompt = buildRAGSystemPrompt(fileContextString, integrationContextString);

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

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Build combined sources
    const sources = [
      // File sources
      ...ragContext.sources.map((source) => ({
        type: 'file_upload' as const,
        name: source.name,
        relevance: source.relevanceScore,
      })),
      // Integration sources
      ...integrationContext.results.map((result) => ({
        type: result.source,
        name: result.title,
        url: result.url,
        relevance: 1,
      })),
    ];

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
