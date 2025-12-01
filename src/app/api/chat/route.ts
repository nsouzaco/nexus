import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, CoreMessage, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createAgentTools, getAgentSystemPrompt } from '@/lib/ai/agent';
import { getConnectedIntegrations } from '@/services/integrations';
import { Langfuse } from 'langfuse';

// Initialize Langfuse client
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://us.cloud.langfuse.com',
});

// Debug log entry type
export interface DebugLogEntry {
  timestamp: string;
  type: 'tool_call' | 'tool_result' | 'step_start' | 'step_finish' | 'thinking' | 'error';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  stepType?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  text?: string;
  error?: string;
}

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

    const { message, conversationId, messages: clientMessages, debugMode = false } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Debug logs array to capture step-by-step information
    const debugLogs: DebugLogEntry[] = [];

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
    
    // Get system prompt (with debug instructions if enabled)
    const systemPrompt = getAgentSystemPrompt(connectedIntegrations, debugMode);
    
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
    
    // Create Langfuse trace for this conversation
    const trace = langfuse.trace({
      name: 'chat',
      userId: user.id,
      sessionId: currentConversationId,
      metadata: {
        connectedIntegrations,
        isCasual,
        messageCount: aiMessages.length,
      },
      input: message,
    });
    
    // Log initial request info for debugging
    if (debugMode) {
      console.log('\n[AGENT DEBUG] ═══════════════════════════════════════════');
      console.log('[AGENT DEBUG] NEW REQUEST');
      console.log('[AGENT DEBUG] ═══════════════════════════════════════════');
      console.log('[AGENT DEBUG] User message:', message);
      console.log('[AGENT DEBUG] Is casual:', isCasual);
      console.log('[AGENT DEBUG] Connected integrations:', connectedIntegrations);
      console.log('[AGENT DEBUG] Message history length:', aiMessages.length);
    }

    // Create generation span for the LLM call
    const generation = trace.generation({
      name: 'agent-response',
      model: 'gpt-4o',
      input: aiMessages,
      metadata: {
        systemPromptLength: systemPrompt.length,
        toolsEnabled: !isCasual,
      },
    });

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: aiMessages,
      tools: isCasual ? undefined : tools,
      stopWhen: isCasual ? stepCountIs(1) : stepCountIs(5), // Allow multi-step tool use for non-casual messages
      temperature: 0.3,
      onStepFinish: async (stepResult) => {
        // Log tool calls to Langfuse
        if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
          for (const toolCall of stepResult.toolCalls) {
            const args = 'args' in toolCall ? toolCall.args : undefined;
            trace.span({
              name: `tool:${toolCall.toolName}`,
              input: args,
            });
          }
        }
        // Capture debug information for each step
        if (debugMode) {
          const usage = stepResult.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
          const stepType = 'finishReason' in stepResult ? String(stepResult.finishReason) : 'unknown';
          
          // Log reasoning text if present (this is the agent's thinking!)
          if (stepResult.text && stepResult.text.trim()) {
            console.log('\n[AGENT REASONING] ─────────────────────────────────────');
            const reasoningText = stepResult.text.slice(0, 1500);
            console.log(reasoningText);
            if (stepResult.text.length > 1500) console.log('... (truncated)');
            console.log('─────────────────────────────────────────────────────────');
          }
          
          debugLogs.push({
            timestamp: new Date().toISOString(),
            type: 'step_finish',
            stepType,
            text: stepResult.text,
            usage: usage ? {
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            } : undefined,
          });

          // Log each tool call with its arguments
          if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
            console.log('\n[AGENT DECISION] Calling tools:');
            for (const toolCall of stepResult.toolCalls) {
              const args = 'args' in toolCall ? toolCall.args : undefined;
              const argsStr = args !== undefined ? JSON.stringify(args) : 'no args';
              console.log(`  → ${toolCall.toolName}(${argsStr})`);
              
              debugLogs.push({
                timestamp: new Date().toISOString(),
                type: 'tool_call',
                toolName: toolCall.toolName,
                toolArgs: args as Record<string, unknown>,
              });
            }
          }

          // Log tool results (truncated for readability)
          if (stepResult.toolResults && stepResult.toolResults.length > 0) {
            console.log('\n[AGENT TOOL RESULTS]:');
            for (const toolResult of stepResult.toolResults) {
              const result = 'result' in toolResult ? toolResult.result : undefined;
              const resultStr = result !== undefined ? JSON.stringify(result) : 'undefined';
              const truncated = resultStr.length > 200 ? resultStr.slice(0, 200) + '...' : resultStr;
              console.log(`  ← ${toolResult.toolName}: ${truncated}`);
              
              debugLogs.push({
                timestamp: new Date().toISOString(),
                type: 'tool_result',
                toolName: toolResult.toolName,
                toolResult: result,
              });
            }
          }
        }
      },
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
        
        // End Langfuse generation with output and usage
        generation.end({
          output: text,
          usage: totalUsage ? {
            input: totalUsage.inputTokens || 0,
            output: totalUsage.outputTokens || 0,
            total: (totalUsage.inputTokens || 0) + (totalUsage.outputTokens || 0),
          } : undefined,
          metadata: {
            toolCallCount: toolCalls?.length || 0,
          },
        });
        
        // End trace with final output
        trace.update({
          output: text,
        });
        
        // Flush to ensure data is sent
        await langfuse.flushAsync();
        
        // Log final debug summary to console
        if (debugMode && debugLogs.length > 0) {
          console.log('\n[AGENT DEBUG SUMMARY]');
          console.log('='.repeat(50));
          debugLogs.forEach((log, i) => {
            console.log(`${i + 1}. [${log.type}] ${log.toolName || log.stepType || ''}`);
            if (log.toolArgs) console.log('   Args:', JSON.stringify(log.toolArgs, null, 2));
            if (log.toolResult) console.log('   Result:', JSON.stringify(log.toolResult, null, 2).slice(0, 500));
            if (log.usage) console.log('   Tokens:', log.usage.totalTokens);
          });
          console.log('='.repeat(50));
        }

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
