import { createClient } from '@/lib/supabase/server';

interface AirtableSearchResult {
  id: string;
  type: 'base' | 'table' | 'record';
  title: string;
  url: string;
  content: string;
  baseName?: string;
  tableName?: string;
}

/**
 * Get Airtable access token for a user
 */
async function getAirtableToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'airtable')
    .eq('status', 'active')
    .single();

  if (!integration?.access_token) {
    return null;
  }

  return integration.access_token;
}

/**
 * Search Airtable for relevant content
 */
export async function searchAirtable(
  userId: string,
  query: string,
  limit: number = 20
): Promise<AirtableSearchResult[]> {
  const accessToken = await getAirtableToken(userId);
  
  if (!accessToken) {
    console.log('Airtable: No access token found');
    return [];
  }

  const results: AirtableSearchResult[] = [];

  try {
    // Get all bases
    const bases = await getBases(accessToken);
    console.log('Airtable bases found:', bases.length, bases.map(b => b.name));
    
    if (bases.length === 0) {
      console.log('Airtable: No bases accessible with this token');
      return [];
    }
    
    // Search through each base's tables
    for (const base of bases.slice(0, 3)) { // Limit to 3 bases
      const tables = await getTables(accessToken, base.id);
      console.log(`Airtable tables in ${base.name}:`, tables.map(t => t.name));
      
      // Fetch ALL records from ALL tables
      for (const table of tables) {
        // Use table NAME for the API call (works more reliably than ID)
        const records = await getAllRecords(accessToken, base.id, table.name);
        console.log(`Airtable records in ${table.name}:`, records.length);
        
        for (const record of records) {
          results.push({
            id: record.id,
            type: 'record',
            title: `${base.name} / ${table.name}`,
            url: `https://airtable.com/${base.id}/${table.id}/${record.id}`,
            content: formatRecordContent(record.fields, table.name),
            baseName: base.name,
            tableName: table.name,
          });
        }
      }
    }

    console.log('Airtable total results:', results.length);
    return results.slice(0, limit);
  } catch (error) {
    console.error('Airtable search error:', error);
    return results;
  }
}

/**
 * Get all bases for the user
 */
async function getBases(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.bases || []).map((base: any) => ({
      id: base.id,
      name: base.name,
    }));
  } catch (error) {
    console.error('Error fetching bases:', error);
    return [];
  }
}

/**
 * Get tables in a base
 */
async function getTables(
  accessToken: string,
  baseId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.tables || []).map((table: any) => ({
      id: table.id,
      name: table.name,
    }));
  } catch (error) {
    console.error('Error fetching tables:', error);
    return [];
  }
}

/**
 * Get ALL records from a table
 */
async function getAllRecords(
  accessToken: string,
  baseId: string,
  tableName: string
): Promise<Array<{ id: string; fields: Record<string, any> }>> {
  try {
    // Use table name (URL encoded) for the API call - fetch up to 100 records
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=100`;
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Airtable API error for ${tableName}:`, res.status, errorText);
      return [];
    }

    const data = await res.json();
    const records = data.records || [];
    
    return records.map((record: any) => ({
      id: record.id,
      fields: record.fields,
    }));
  } catch (error) {
    console.error('Error fetching records:', error);
    return [];
  }
}

/**
 * Search records in a table (with keyword filtering)
 */
async function searchRecords(
  accessToken: string,
  baseId: string,
  tableName: string,
  query: string,
  limit: number
): Promise<Array<{ id: string; fields: Record<string, any> }>> {
  try {
    // Use table name (URL encoded) for the API call
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=${limit * 3}`;
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Airtable API error for ${tableName}:`, res.status, errorText);
      return [];
    }

    const data = await res.json();
    const records = data.records || [];
    
    // Extract keywords from query for flexible matching
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Score and sort records by relevance
    const scoredRecords = records.map((record: any) => {
      const fieldsText = JSON.stringify(record.fields).toLowerCase();
      let score = 0;
      
      // Check for keyword matches
      for (const word of queryWords) {
        if (fieldsText.includes(word)) {
          score += 1;
        }
      }
      
      return { record, score };
    });
    
    // Sort by score (highest first), then return top results
    // If no matches, still return some records for context
    scoredRecords.sort((a, b) => b.score - a.score);
    
    const topRecords = scoredRecords.slice(0, limit);
    
    return topRecords.map(({ record }) => ({
      id: record.id,
      fields: record.fields,
    }));
  } catch (error) {
    console.error('Error searching records:', error);
    return [];
  }
}

/**
 * Format record fields as readable content
 */
function formatRecordContent(fields: Record<string, any>, tableName: string): string {
  const lines = [`Table: ${tableName}`];
  
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined) {
      let displayValue: string;
      
      if (Array.isArray(value)) {
        displayValue = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }
      
      lines.push(`${key}: ${displayValue}`);
    }
  }
  
  return lines.join('\n').slice(0, 1000);
}

/**
 * Get bases summary for user
 */
export async function getBasesSummary(userId: string): Promise<AirtableSearchResult[]> {
  const accessToken = await getAirtableToken(userId);
  
  if (!accessToken) {
    return [];
  }

  try {
    const bases = await getBases(accessToken);
    
    return bases.map(base => ({
      id: base.id,
      type: 'base' as const,
      title: base.name,
      url: `https://airtable.com/${base.id}`,
      content: `Airtable Base: ${base.name}`,
    }));
  } catch (error) {
    console.error('Error fetching bases summary:', error);
    return [];
  }
}

/**
 * Check if user has Airtable connected
 */
export async function hasAirtableConnected(userId: string): Promise<boolean> {
  const token = await getAirtableToken(userId);
  return token !== null;
}

