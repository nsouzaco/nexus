import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, CoreMessage, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createAgentTools, getAgentSystemPrompt } from '@/lib/ai/agent';
import { getConnectedIntegrations } from '@/services/integrations';

/**
 * Check if the query is a casual/greeting message that doesn't need tools
 */
function isCasualMessage(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  
  const casualPatterns = [
    /^(hi|hey|hello|howdy|sup|yo|hola|greetings)[\s!.,?]*$/i,
    /^(good\s*(morning|afternoon|evening|night))[\s!.,?]*$/i,
    /^(how\s*(are\s+you|is\s+it\s+going|do\s+you\s+do))[\s!.,?]*$/i,
    /^(what'?s\s+up|wassup|whats\s+up)[\s!.,?]*$/i,
    /^(thanks?|thank\s+you|thx|ty)[\s!.,?]*$/i,
    /^(ok|okay|sure|got\s+it|understood|cool|great|nice|awesome)[\s!.,?]*$/i,
    /^(bye|goodbye|see\s+you|later|cya)[\s!.,?]*$/i,
    /^(yes|no|yep|nope|yeah|nah)[\s!.,?]*$/i,
    /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do)[\s!.,?]*$/i,
  ];
  
  if (casualPatterns.some(pattern => pattern.test(normalizedQuery))) {
    return true;
  }
  
  if (normalizedQuery.length < 10) {
    return true;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, conversationId, messages: clientMessages } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
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
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      currentConversationId = newConversation.id;
    }

    // Save user message
    await supabase
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: message,
      });

    // Get connected integrations for context
    const connectedIntegrations = await getConnectedIntegrations(user.id);
    
    // Create tools for this user
    const tools = createAgentTools(user.id);
    
    // Get system prompt
    const systemPrompt = getAgentSystemPrompt(connectedIntegrations);
    
    // Build messages array using CoreMessage format
    let aiMessages: CoreMessage[] = [];
    
    if (clientMessages && Array.isArray(clientMessages)) {
      // Convert client-provided message history to CoreMessage format
      aiMessages = clientMessages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
    } else {
      // Fetch from database
      const { data: history } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: true })
        .limit(20);
      
      if (history) {
        aiMessages = history.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
      }
    }
    
    // Add current message if not already in history
    const lastMessage = aiMessages[aiMessages.length - 1];
    if (!lastMessage || lastMessage.content !== message || lastMessage.role !== 'user') {
      aiMessages.push({
        role: 'user',
        content: message,
      });
    }

    // Check if this is a casual message (don't use tools for greetings)
    const isCasual = isCasualMessage(message);
    
    // Stream the response using Vercel AI SDK
    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: aiMessages,
      tools: isCasual ? undefined : tools,
      stopWhen: isCasual ? stepCountIs(1) : stepCountIs(5), // Allow multi-step tool use for non-casual messages
      temperature: 0.3,
      onFinish: async ({ text, totalUsage, toolCalls }) => {
        // Save assistant message to database
        const toolCallsData = toolCalls && toolCalls.length > 0 
          ? toolCalls.map(tc => ({
              name: tc.toolName,
              arguments: 'args' in tc ? tc.args : undefined,
            }))
          : null;

        await supabase
          .from('messages')
          .insert({
            conversation_id: currentConversationId,
            role: 'assistant',
            content: text,
            sources: toolCallsData,
          });

        // Update conversation timestamp
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentConversationId);

        console.log('Message saved. Tokens used:', totalUsage);
      },
    });

    // Return streaming response with conversation ID in headers
    return result.toTextStreamResponse({
      headers: {
        'X-Conversation-Id': currentConversationId,
        'X-Connected-Integrations': connectedIntegrations.join(','),
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Get conversations list
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Failed to fetch conversations' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      conversations: conversationsResult.data,
      connectedIntegrations,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
