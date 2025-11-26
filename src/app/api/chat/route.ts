import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { retrieveContext, buildContextString, buildRAGSystemPrompt } from '@/services/rag.service';

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

    // Retrieve RAG context from uploaded files
    const ragContext = await retrieveContext(user.id, message);
    const contextString = buildContextString(ragContext);
    const systemPrompt = buildRAGSystemPrompt(contextString);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Build sources from RAG context
    const sources = ragContext.sources.map((source) => ({
      type: source.type,
      name: source.name,
      relevance: source.relevanceScore,
    }));

    return NextResponse.json({
      message: assistantMessage,
      sources,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

