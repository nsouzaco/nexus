import { Client } from '@notionhq/client';
import { createClient } from '@/lib/supabase/server';

interface NotionSearchResult {
  id: string;
  type: 'page' | 'database';
  title: string;
  url: string;
  content: string;
  lastEdited: string;
}

/**
 * Get Notion client for a user
 */
async function getNotionClient(userId: string): Promise<Client | null> {
  const supabase = await createClient();
  
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'notion')
    .eq('status', 'active')
    .single();

  if (!integration?.access_token) {
    return null;
  }

  return new Client({ auth: integration.access_token });
}

/**
 * Search Notion for relevant content
 */
export async function searchNotion(
  userId: string,
  query: string,
  limit: number = 5
): Promise<NotionSearchResult[]> {
  const notion = await getNotionClient(userId);
  
  if (!notion) {
    return [];
  }

  try {
    const response = await notion.search({
      query,
      page_size: limit,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
    });

    const results: NotionSearchResult[] = [];

    for (const result of response.results) {
      const resultAny = result as any;
      
      if (resultAny.object === 'page') {
        const title = getPageTitle(resultAny);
        const content = await getPageContent(notion, resultAny.id);
        
        results.push({
          id: resultAny.id,
          type: 'page',
          title,
          url: resultAny.url,
          content,
          lastEdited: resultAny.last_edited_time,
        });
      } else if (resultAny.object === 'database') {
        const title = getDatabaseTitle(resultAny);
        const content = await queryDatabaseRecords(notion, resultAny.id);
        
        results.push({
          id: resultAny.id,
          type: 'database',
          title,
          url: resultAny.url,
          content,
          lastEdited: resultAny.last_edited_time,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Notion search error:', error);
    return [];
  }
}

/**
 * Get page title from Notion page object
 */
function getPageTitle(page: any): string {
  const titleProp = page.properties?.title || page.properties?.Name;
  if (titleProp?.title?.[0]?.plain_text) {
    return titleProp.title[0].plain_text;
  }
  return 'Untitled';
}

/**
 * Get database title
 */
function getDatabaseTitle(db: any): string {
  if (db.title?.[0]?.plain_text) {
    return db.title[0].plain_text;
  }
  return 'Untitled Database';
}

/**
 * Get page content as text
 */
async function getPageContent(notion: Client, pageId: string): Promise<string> {
  try {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 50,
    });

    const textParts: string[] = [];

    for (const block of blocks.results) {
      const text = extractBlockText(block as any);
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join('\n').slice(0, 2000); // Limit content length
  } catch (error) {
    console.error('Error fetching page content:', error);
    return '';
  }
}

/**
 * Query database records
 */
async function queryDatabaseRecords(notion: Client, databaseId: string): Promise<string> {
  try {
    // Use the pages list endpoint filtered by database
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'page',
      },
      page_size: 10,
    });

    const rows: string[] = [];

    for (const page of response.results) {
      const pageAny = page as any;
      if (pageAny.parent?.database_id === databaseId) {
        const props = pageAny.properties;
        const row: string[] = [];
        
        for (const [key, value] of Object.entries(props)) {
          const text = extractPropertyValue(value);
          if (text) {
            row.push(`${key}: ${text}`);
          }
        }
        
        if (row.length > 0) {
          rows.push(row.join(', '));
        }
      }
    }

    return rows.join('\n').slice(0, 2000);
  } catch (error) {
    console.error('Error fetching database content:', error);
    return '';
  }
}

/**
 * Extract text from a Notion block
 */
function extractBlockText(block: any): string {
  const type = block.type;
  const content = block[type];

  if (!content) return '';

  // Handle rich text blocks
  if (content.rich_text) {
    return content.rich_text.map((t: any) => t.plain_text).join('');
  }

  // Handle specific block types
  switch (type) {
    case 'paragraph':
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'quote':
    case 'callout':
      return content.rich_text?.map((t: any) => t.plain_text).join('') || '';
    case 'code':
      return `Code: ${content.rich_text?.map((t: any) => t.plain_text).join('') || ''}`;
    case 'to_do':
      const checked = content.checked ? '✓' : '○';
      return `${checked} ${content.rich_text?.map((t: any) => t.plain_text).join('') || ''}`;
    default:
      return '';
  }
}

/**
 * Extract value from a Notion property
 */
function extractPropertyValue(prop: any): string {
  if (!prop) return '';

  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return prop[prop.type]?.map((t: any) => t.plain_text).join('') || '';
    case 'number':
      return prop.number?.toString() || '';
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
    case 'date':
      return prop.date?.start || '';
    case 'checkbox':
      return prop.checkbox ? 'Yes' : 'No';
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'phone_number':
      return prop.phone_number || '';
    case 'status':
      return prop.status?.name || '';
    default:
      return '';
  }
}

/**
 * Check if user has Notion connected
 */
export async function hasNotionConnected(userId: string): Promise<boolean> {
  const notion = await getNotionClient(userId);
  return notion !== null;
}

