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
 * Search Airtable for relevant content - returns ALL records from all tables
 */
export async function searchAirtable(
  userId: string,
  _query: string,
  _limit?: number
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
    
    // Fetch ALL records from ALL tables in ALL bases (no limits)
    for (const base of bases) {
      const tables = await getTables(accessToken, base.id);
      console.log(`Airtable tables in ${base.name}:`, tables.map(t => t.name));
      
      for (const table of tables) {
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
    return results; // Return ALL results, no limit
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
    scoredRecords.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    
    const topRecords = scoredRecords.slice(0, limit);
    
    return topRecords.map(({ record }: { record: { id: string; fields: Record<string, unknown> } }) => ({
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

// ============================================================================
// Write Operations
// ============================================================================

interface AirtableWriteResult {
  id: string;
  url: string;
  fields?: Record<string, unknown>;
}

interface AirtableWriteError {
  error: string;
}

/**
 * Find base ID by name
 */
async function findBaseId(accessToken: string, baseName: string): Promise<string | null> {
  const bases = await getBases(accessToken);
  const base = bases.find(b => b.name.toLowerCase() === baseName.toLowerCase());
  return base?.id || null;
}

/**
 * Find table ID by name
 */
async function findTableId(accessToken: string, baseId: string, tableName: string): Promise<string | null> {
  const tables = await getTables(accessToken, baseId);
  const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  return table?.id || null;
}

/**
 * Create a new record in an Airtable table
 */
export async function createAirtableRecord(
  userId: string,
  baseName: string,
  tableName: string,
  fields: Record<string, unknown>
): Promise<AirtableWriteResult | AirtableWriteError> {
  const accessToken = await getAirtableToken(userId);
  
  if (!accessToken) {
    return { error: 'Airtable is not connected' };
  }

  try {
    // Find base ID
    const baseId = await findBaseId(accessToken, baseName);
    if (!baseId) {
      return { error: `Base "${baseName}" not found` };
    }

    // Find table ID
    const tableId = await findTableId(accessToken, baseId, tableName);
    if (!tableId) {
      return { error: `Table "${tableName}" not found in base "${baseName}"` };
    }

    // Create record
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      return { error: errorData.error?.message || 'Failed to create record' };
    }

    const record = await res.json();
    
    return {
      id: record.id,
      url: `https://airtable.com/${baseId}/${tableId}/${record.id}`,
      fields: record.fields,
    };
  } catch (error) {
    console.error('Error creating Airtable record:', error);
    return { error: 'Failed to create record' };
  }
}

/**
 * Update an existing record in Airtable
 */
export async function updateAirtableRecord(
  userId: string,
  baseName: string,
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableWriteResult | AirtableWriteError> {
  const accessToken = await getAirtableToken(userId);
  
  if (!accessToken) {
    return { error: 'Airtable is not connected' };
  }

  try {
    // Find base ID
    const baseId = await findBaseId(accessToken, baseName);
    if (!baseId) {
      return { error: `Base "${baseName}" not found` };
    }

    // Update record
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      return { error: errorData.error?.message || 'Failed to update record' };
    }

    const record = await res.json();
    
    return {
      id: record.id,
      url: `https://airtable.com/${baseId}`,
      fields: record.fields,
    };
  } catch (error) {
    console.error('Error updating Airtable record:', error);
    return { error: 'Failed to update record' };
  }
}

