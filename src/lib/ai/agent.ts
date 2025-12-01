import { z } from 'zod';
import { 
  searchAirtable, 
  createAirtableRecord, 
  updateAirtableRecord,
  hasAirtableConnected 
} from '@/services/integrations/airtable.service';
import { 
  searchGitHub, 
  createGitHubIssue,
  hasGitHubConnected 
} from '@/services/integrations/github.service';
import { 
  searchNotion, 
  createNotionPage,
  hasNotionConnected 
} from '@/services/integrations/notion.service';
import { 
  searchGoogleDrive, 
  hasGoogleDriveConnected 
} from '@/services/integrations/google-drive.service';
import { retrieveContext } from '@/services/rag.service';
import { webSearch } from '@/services/web-search.service';

// ============================================================================
// Tool Definitions with Execute Functions
// ============================================================================

export function createAgentTools(userId: string) {
  return {
    // Search Airtable
    searchAirtable: {
      description: 'Search Airtable records across all connected bases and tables. Use this to find specific data, records, or information stored in Airtable.',
      inputSchema: z.object({
        query: z.string().describe('Search query to find relevant records'),
        baseName: z.string().optional().describe('Optional: filter to a specific base name'),
        tableName: z.string().optional().describe('Optional: filter to a specific table name'),
      }),
      execute: async ({ query, baseName, tableName }: { query: string; baseName?: string; tableName?: string }) => {
        const isConnected = await hasAirtableConnected(userId);
        if (!isConnected) {
          return { error: 'Airtable is not connected. Please connect it from the Dashboard.' };
        }
        
        const results = await searchAirtable(userId, query);
        
        // Filter by base/table if specified
        let filtered = results;
        if (baseName) {
          filtered = filtered.filter(r => r.baseName?.toLowerCase().includes(baseName.toLowerCase()));
        }
        if (tableName) {
          filtered = filtered.filter(r => r.tableName?.toLowerCase().includes(tableName.toLowerCase()));
        }
        
        if (filtered.length === 0) {
          return { message: 'No matching records found in Airtable.', results: [] };
        }
        
        return {
          message: `Found ${filtered.length} records in Airtable.`,
          results: filtered.map(r => ({
            id: r.id,
            title: r.title,
            content: r.content,
            url: r.url,
            baseName: r.baseName,
            tableName: r.tableName,
          })),
        };
      },
    },

    // Search GitHub
    searchGitHub: {
      description: 'Search GitHub repositories, issues, and code. Use this to find repos, issues, pull requests, or code files.',
      inputSchema: z.object({
        query: z.string().describe('Search query for repositories, issues, or code'),
        type: z.enum(['repos', 'issues', 'code']).optional().describe('Type of search: repos, issues, or code'),
      }),
      execute: async ({ query }: { query: string }) => {
        const isConnected = await hasGitHubConnected(userId);
        if (!isConnected) {
          return { error: 'GitHub is not connected. Please connect it from the Dashboard.' };
        }
        
        const results = await searchGitHub(userId, query, 10);
        
        if (results.length === 0) {
          return { message: 'No matching results found in GitHub.', results: [] };
        }
        
        return {
          message: `Found ${results.length} results in GitHub.`,
          results: results.map(r => ({
            id: r.id,
            type: r.type,
            title: r.title,
            url: r.url,
            content: r.content,
            updatedAt: r.updatedAt,
          })),
        };
      },
    },

    // Search Notion
    searchNotion: {
      description: 'Search Notion pages and databases. Use this to find documents, notes, wikis, or database entries in Notion.',
      inputSchema: z.object({
        query: z.string().describe('Search query for Notion pages and databases'),
      }),
      execute: async ({ query }: { query: string }) => {
        const isConnected = await hasNotionConnected(userId);
        if (!isConnected) {
          return { error: 'Notion is not connected. Please connect it from the Dashboard.' };
        }
        
        const results = await searchNotion(userId, query, 10);
        
        if (results.length === 0) {
          return { message: 'No matching pages found in Notion.', results: [] };
        }
        
        return {
          message: `Found ${results.length} pages in Notion.`,
          results: results.map(r => ({
            id: r.id,
            type: r.type,
            title: r.title,
            url: r.url,
            content: r.content,
            lastEdited: r.lastEdited,
          })),
        };
      },
    },

    // Search Google Drive
    searchGoogleDrive: {
      description: 'Search Google Drive files. Use this to find documents, spreadsheets, presentations, or other files.',
      inputSchema: z.object({
        query: z.string().describe('Search query for Google Drive files'),
      }),
      execute: async ({ query }: { query: string }) => {
        const isConnected = await hasGoogleDriveConnected(userId);
        if (!isConnected) {
          return { error: 'Google Drive is not connected. Please connect it from the Dashboard.' };
        }
        
        const results = await searchGoogleDrive(userId, query, 10);
        
        if (results.length === 0) {
          return { message: 'No matching files found in Google Drive.', results: [] };
        }
        
        return {
          message: `Found ${results.length} files in Google Drive.`,
          results: results.map(r => ({
            id: r.id,
            title: r.title,
            url: r.url,
            content: r.content,
            mimeType: r.mimeType,
            modifiedTime: r.modifiedTime,
          })),
        };
      },
    },

    // Search Files (RAG)
    searchFiles: {
      description: 'Search through user-uploaded files using semantic search. Use this to find information in PDFs, documents, CSVs, and other uploaded files.',
      inputSchema: z.object({
        query: z.string().describe('Search query to find relevant content in uploaded files'),
        limit: z.number().optional().default(5).describe('Maximum number of results to return'),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const context = await retrieveContext(userId, query, limit || 5);
        
        if (context.chunks.length === 0) {
          return { message: 'No matching content found in uploaded files.', results: [] };
        }
        
        return {
          message: `Found ${context.chunks.length} relevant sections from uploaded files.`,
          results: context.chunks.map(chunk => ({
            filename: chunk.metadata.filename,
            content: chunk.content,
            relevanceScore: chunk.score,
          })),
        };
      },
    },

    // Create Airtable Record
    createAirtableRecord: {
      description: 'Create a new record in an Airtable table. Use this when the user wants to add new data to Airtable.',
      inputSchema: z.object({
        baseName: z.string().describe('Name of the Airtable base'),
        tableName: z.string().describe('Name of the table to create the record in'),
        fields: z.record(z.unknown()).describe('Object containing field names and values for the new record'),
      }),
      execute: async ({ baseName, tableName, fields }: { baseName: string; tableName: string; fields: Record<string, unknown> }) => {
        const isConnected = await hasAirtableConnected(userId);
        if (!isConnected) {
          return { error: 'Airtable is not connected. Please connect it from the Dashboard.' };
        }
        
        const result = await createAirtableRecord(userId, baseName, tableName, fields);
        
        if ('error' in result) {
          return { error: result.error };
        }
        
        return {
          success: true,
          message: `Created new record in ${baseName}/${tableName}`,
          recordId: result.id,
          url: result.url,
        };
      },
    },

    // Update Airtable Record
    updateAirtableRecord: {
      description: 'Update an existing record in Airtable. Use this when the user wants to modify existing data.',
      inputSchema: z.object({
        baseName: z.string().describe('Name of the Airtable base'),
        tableName: z.string().describe('Name of the table'),
        recordId: z.string().describe('ID of the record to update'),
        fields: z.record(z.unknown()).describe('Object containing field names and new values'),
      }),
      execute: async ({ baseName, tableName, recordId, fields }: { baseName: string; tableName: string; recordId: string; fields: Record<string, unknown> }) => {
        const isConnected = await hasAirtableConnected(userId);
        if (!isConnected) {
          return { error: 'Airtable is not connected. Please connect it from the Dashboard.' };
        }
        
        const result = await updateAirtableRecord(userId, baseName, tableName, recordId, fields);
        
        if ('error' in result) {
          return { error: result.error };
        }
        
        return {
          success: true,
          message: `Updated record ${recordId} in ${baseName}/${tableName}`,
          recordId: result.id,
        };
      },
    },

    // Create GitHub Issue
    createGitHubIssue: {
      description: 'Create a new issue in a GitHub repository. Use this when the user wants to create a bug report, feature request, or task.',
      inputSchema: z.object({
        repo: z.string().describe('Repository name in format "owner/repo"'),
        title: z.string().describe('Title of the issue'),
        body: z.string().describe('Body/description of the issue'),
        labels: z.array(z.string()).optional().describe('Optional labels to add to the issue'),
      }),
      execute: async ({ repo, title, body, labels }: { repo: string; title: string; body: string; labels?: string[] }) => {
        const isConnected = await hasGitHubConnected(userId);
        if (!isConnected) {
          return { error: 'GitHub is not connected. Please connect it from the Dashboard.' };
        }
        
        const result = await createGitHubIssue(userId, repo, title, body, labels);
        
        if ('error' in result) {
          return { error: result.error };
        }
        
        return {
          success: true,
          message: `Created issue #${result.number} in ${repo}`,
          issueNumber: result.number,
          url: result.url,
        };
      },
    },

    // Create Notion Page
    createNotionPage: {
      description: 'Create a new page in Notion. Use this when the user wants to create a new document or note.',
      inputSchema: z.object({
        title: z.string().describe('Title of the new page'),
        content: z.string().describe('Content/body of the page in markdown format'),
        parentPageId: z.string().optional().describe('Optional parent page ID to create the page under'),
      }),
      execute: async ({ title, content, parentPageId }: { title: string; content: string; parentPageId?: string }) => {
        const isConnected = await hasNotionConnected(userId);
        if (!isConnected) {
          return { error: 'Notion is not connected. Please connect it from the Dashboard.' };
        }
        
        const result = await createNotionPage(userId, title, content, parentPageId);
        
        if ('error' in result) {
          return { error: result.error };
        }
        
        return {
          success: true,
          message: `Created page "${title}" in Notion`,
          pageId: result.id,
          url: result.url,
        };
      },
    },

    // Generate Chart
    generateChart: {
      description: 'Generate a chart visualization from data. Use this when the user wants to see data visualized as a chart, graph, or plot.',
      inputSchema: z.object({
        type: z.enum(['line', 'bar', 'area', 'pie']).describe('Type of chart to generate'),
        title: z.string().describe('Title for the chart'),
        data: z.array(z.record(z.unknown())).describe('Array of data objects for the chart'),
        xKey: z.string().describe('Key in data objects to use for x-axis'),
        yKey: z.union([z.string(), z.array(z.string())]).describe('Key(s) in data objects to use for y-axis values'),
        colors: z.array(z.string()).optional().describe('Optional array of colors for the chart series'),
      }),
      execute: async ({ type, title, data, xKey, yKey, colors }: { 
        type: 'line' | 'bar' | 'area' | 'pie'; 
        title: string; 
        data: Record<string, unknown>[]; 
        xKey: string; 
        yKey: string | string[]; 
        colors?: string[] 
      }) => {
        // Return chart configuration that will be rendered by the frontend
        return {
          type: 'chart',
          config: {
            type,
            title,
            data,
            xKey,
            yKey,
            colors,
          },
        };
      },
    },

    // Execute Code
    executeCode: {
      description: 'Execute JavaScript code for calculations, data transformations, or analysis. Use this for mathematical operations, data processing, or any computation the user needs.',
      inputSchema: z.object({
        code: z.string().describe('JavaScript code to execute. Must return a value. Has access to Math object and basic JS operations.'),
        description: z.string().describe('Brief description of what this code does'),
      }),
      execute: async ({ code, description }: { code: string; description: string }) => {
        try {
          // Create a sandboxed function with limited scope
          // Only allow Math, JSON, Array, Object, String, Number, Boolean, Date
          const sandbox = {
            Math,
            JSON,
            Array,
            Object,
            String,
            Number,
            Boolean,
            Date,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            console: { log: () => {} }, // Stub console
          };
          
          const sandboxKeys = Object.keys(sandbox);
          const sandboxValues = Object.values(sandbox);
          
          // Create function with sandbox
          const fn = new Function(...sandboxKeys, `"use strict"; return (${code});`);
          const result = fn(...sandboxValues);
          
          return {
            success: true,
            description,
            result,
          };
        } catch (error) {
          return {
            error: `Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    },

    // Web Search
    webSearch: {
      description: 'Search the web for current information. Use this when the user needs up-to-date information, external data, or information not available in their connected tools.',
      inputSchema: z.object({
        query: z.string().describe('Search query to find information on the web'),
      }),
      execute: async ({ query }: { query: string }) => {
        const results = await webSearch(query);
        
        if ('error' in results) {
          return { error: results.error };
        }
        
        if (results.results.length === 0) {
          return { message: 'No results found for your search.', results: [] };
        }
        
        return {
          message: `Found ${results.results.length} web results.`,
          results: results.results,
        };
      },
    },
  };
}

// ============================================================================
// System Prompt for Agentic Mode
// ============================================================================

export function getAgentSystemPrompt(connectedIntegrations: string[], debugMode: boolean = false): string {
  const integrationNames = connectedIntegrations.map(i => {
    switch(i) {
      case 'google_drive': return 'Google Drive';
      case 'github': return 'GitHub';
      case 'notion': return 'Notion';
      case 'airtable': return 'Airtable';
      default: return i;
    }
  });

  const debugInstructions = debugMode ? `

## Debug Mode (ACTIVE) - IMPORTANT: READ CAREFULLY

**You MUST output text BEFORE calling any tools.** Never call a tool without first explaining your reasoning.

For EVERY user message, start your response with this exact format:

<thinking>
1. USER INTENT: What does the user want? (one sentence)
2. INTERPRETATION: How I'm interpreting ambiguous parts
3. AVAILABLE DATA: Which connected integrations might have this info
4. CHOSEN APPROACH: Which tool(s) I'll use and why
5. CONFIDENCE: High/Medium/Low - and why
</thinking>

Then proceed to call the appropriate tool(s).

RULES:
- ALWAYS output the <thinking> block FIRST before any tool call
- If something is unclear, say so in the thinking block
- If confidence is Low, ask for clarification instead of guessing
- Never skip the thinking block, even for simple requests
` : '';

  return `You are Adapt, an intelligent business assistant with the ability to take actions on behalf of the user.${debugInstructions}

## Your Capabilities

You have access to powerful tools that let you:

**Search & Retrieve:**
- Search Airtable records, bases, and tables
- Search GitHub repos, issues, and code
- Search Notion pages and databases
- Search Google Drive files
- Search user-uploaded files (PDFs, docs, CSVs)
- Search the web for external information

**Create & Modify:**
- Create new Airtable records
- Update existing Airtable records
- Create GitHub issues
- Create Notion pages

**Analyze & Visualize:**
- Execute calculations and data analysis
- Generate charts and visualizations

## Connected Integrations

The user has connected: ${integrationNames.length > 0 ? integrationNames.join(', ') : 'None yet'}

## Understanding Airtable Structure

Airtable is organized hierarchically:
- **Bases** (like databases) contain multiple **Tables**
- **Tables** (like spreadsheets) contain **Records** (rows)

When you search Airtable, you receive ALL records from ALL tables in ALL bases. Each result includes:
- \`baseName\`: The base it belongs to (e.g., "Project Central")
- \`tableName\`: The table within that base (e.g., "Projects", "Revenue", "Team Members")
- \`content\`: The record's field values

**Important:** When a user asks for "projects", look for records where \`tableName\` contains "Projects" — don't look for a base named "Projects". The base name and table name are different things.

Example: If user asks "show my projects", search Airtable and look at results where tableName is "Projects". If they ask for "revenue data", look for tableName "Revenue".

## How to Use Tools

1. **Think before acting:** Consider what information you need and which tool is best suited
2. **Be efficient:** Use the most direct tool for the task. Don't search multiple sources if one will do.
3. **Chain when needed:** You can use multiple tools in sequence to complete complex tasks
4. **Confirm destructive actions:** Before creating or modifying data, confirm with the user

## Response Guidelines

- Be conversational and helpful
- Explain what you're doing when using tools
- Summarize results clearly
- If a tool returns an error, explain the issue and suggest solutions

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
1. Always use real data from the context or tool results - never make up numbers
2. The "data" array must contain objects with the keys specified in xKey and yKey
3. For multiple lines/bars, use an array for yKey: ["revenue", "expenses"]
4. Include a descriptive title
5. Add a brief text explanation before or after the chart

## Important Rules

1. Never make up data - only report what tools return
2. Always use the correct tool for the task
3. If you're unsure which integration has the data, ask the user
4. For write operations, confirm before proceeding unless the request is explicit
5. Handle errors gracefully and suggest alternatives

## Response Formatting

- When listing GitHub repositories, show: repo name, description (if available), link, and last updated date. Do NOT include the programming language unless specifically asked.
- Keep responses concise and focused on what the user asked for.

Remember: You're a capable assistant that can actually DO things, not just answer questions. Take initiative when appropriate, but always keep the user informed.`;
}
