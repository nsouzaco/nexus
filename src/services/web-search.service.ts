/**
 * Web Search Service
 * Uses Tavily API for web search functionality
 */

interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface WebSearchResponse {
  results: WebSearchResult[];
}

interface WebSearchError {
  error: string;
}

/**
 * Search the web using Tavily API
 */
export async function webSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse | WebSearchError> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    // Fallback: return a message indicating web search is not configured
    return {
      error: 'Web search is not configured. Please add TAVILY_API_KEY to enable this feature.',
    };
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Tavily API error:', errorData);
      return { error: 'Web search failed. Please try again.' };
    }

    const data = await response.json();
    
    const results: WebSearchResult[] = (data.results || []).map((result: any) => ({
      title: result.title,
      url: result.url,
      content: result.content || result.snippet || '',
      score: result.score,
    }));

    return { results };
  } catch (error) {
    console.error('Web search error:', error);
    return { error: 'Failed to perform web search.' };
  }
}

/**
 * Alternative: DuckDuckGo Instant Answer API (no API key required)
 * This is a fallback option if Tavily is not configured
 */
export async function duckDuckGoSearch(query: string): Promise<WebSearchResponse | WebSearchError> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      return { error: 'Search failed' };
    }

    const data = await response.json();
    const results: WebSearchResult[] = [];

    // Add abstract if available
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Summary',
        url: data.AbstractURL || '',
        content: data.Abstract,
      });
    }

    // Add related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Related',
            url: topic.FirstURL,
            content: topic.Text,
          });
        }
      }
    }

    return { results };
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    return { error: 'Failed to perform search.' };
  }
}


