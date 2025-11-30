import { searchNotion, hasNotionConnected } from './notion.service';
import { searchGoogleDrive, hasGoogleDriveConnected, listDriveFiles } from './google-drive.service';
import { searchGitHub, hasGitHubConnected, getUserRepos } from './github.service';
import { searchAirtable, hasAirtableConnected, getBasesSummary } from './airtable.service';

export interface IntegrationResult {
  source: 'notion' | 'google_drive' | 'github' | 'airtable';
  id: string;
  title: string;
  url: string;
  content: string;
  type?: string;
  updatedAt?: string;
}

export interface IntegrationContext {
  results: IntegrationResult[];
  connectedIntegrations: string[];
}

/**
 * Detect if query is asking to list/show items rather than search
 */
function isListQuery(query: string): boolean {
  const listPatterns = [
    /list\s+(my|all|the)/i,
    /show\s+(my|me|all|the)/i,
    /what('s| is| are)\s+(in\s+)?(my|the)/i,
    /get\s+(my|all|the)/i,
    /(my|all)\s+(files|docs|documents|repos|repositories|bases|tables|pages)/i,
    /what\s+do\s+i\s+have/i,
    /what\s+files/i,
    /recent\s+(files|docs|documents)/i,
  ];
  
  return listPatterns.some(pattern => pattern.test(query));
}

/**
 * Search all connected integrations for relevant content
 */
export async function searchIntegrations(
  userId: string,
  query: string,
  limitPerSource: number = 3
): Promise<IntegrationContext> {
  const connectedIntegrations: string[] = [];
  const results: IntegrationResult[] = [];

  // Check connected integrations
  const [notionConnected, driveConnected, githubConnected, airtableConnected] = await Promise.all([
    hasNotionConnected(userId),
    hasGoogleDriveConnected(userId),
    hasGitHubConnected(userId),
    hasAirtableConnected(userId),
  ]);

  const isListing = isListQuery(query);
  const searchPromises: Promise<void>[] = [];

  // Google Drive
  if (driveConnected) {
    connectedIntegrations.push('google_drive');
    searchPromises.push(
      (isListing ? listDriveFiles(userId, limitPerSource + 2) : searchGoogleDrive(userId, query, limitPerSource))
        .then((driveResults) => {
          for (const result of driveResults) {
            results.push({
              source: 'google_drive',
              id: result.id,
              title: result.title,
              url: result.url,
              content: result.content,
              type: result.mimeType,
              updatedAt: result.modifiedTime,
            });
          }
        })
        .catch((err) => {
          console.error('Google Drive error:', err);
        })
    );
  }

  // GitHub
  if (githubConnected) {
    connectedIntegrations.push('github');
    searchPromises.push(
      (isListing ? getUserRepos(userId, limitPerSource + 2) : searchGitHub(userId, query, limitPerSource))
        .then((githubResults) => {
          for (const result of githubResults) {
            results.push({
              source: 'github',
              id: result.id,
              title: result.title,
              url: result.url,
              content: result.content,
              type: result.type,
              updatedAt: result.updatedAt,
            });
          }
        })
        .catch((err) => {
          console.error('GitHub error:', err);
        })
    );
  }

  // Notion
  if (notionConnected) {
    connectedIntegrations.push('notion');
    searchPromises.push(
      searchNotion(userId, query, limitPerSource)
        .then((notionResults) => {
          for (const result of notionResults) {
            results.push({
              source: 'notion',
              id: result.id,
              title: result.title,
              url: result.url,
              content: result.content,
              type: result.type,
              updatedAt: result.lastEdited,
            });
          }
        })
        .catch((err) => {
          console.error('Notion error:', err);
        })
    );
  }

  // Airtable - ALWAYS fetch ALL records (ignore isListing - we want full data)
  if (airtableConnected) {
    connectedIntegrations.push('airtable');
    searchPromises.push(
      searchAirtable(userId, query)
        .then((airtableResults) => {
          for (const result of airtableResults) {
            results.push({
              source: 'airtable',
              id: result.id,
              title: result.title,
              url: result.url,
              content: result.content,
              type: result.type,
            });
          }
        })
        .catch((err) => {
          console.error('Airtable error:', err);
        })
    );
  }

  // Wait for all searches to complete
  await Promise.all(searchPromises);

  return {
    results,
    connectedIntegrations,
  };
}

/**
 * Build context string from integration results
 */
export function buildIntegrationContextString(context: IntegrationContext): string {
  if (context.results.length === 0) {
    if (context.connectedIntegrations.length === 0) {
      return '';
    }
    return `Connected integrations: ${context.connectedIntegrations.join(', ')}. No matching content found for this query.`;
  }

  const sourceParts = context.results.map((result) => {
    return `<source type="${result.source}" title="${result.title}" url="${result.url}">
${result.content}
</source>`;
  });

  return sourceParts.join('\n\n');
}

/**
 * Get list of connected integrations for a user
 */
export async function getConnectedIntegrations(userId: string): Promise<string[]> {
  const [notionConnected, driveConnected, githubConnected, airtableConnected] = await Promise.all([
    hasNotionConnected(userId),
    hasGoogleDriveConnected(userId),
    hasGitHubConnected(userId),
    hasAirtableConnected(userId),
  ]);

  const connected: string[] = [];
  if (notionConnected) connected.push('notion');
  if (driveConnected) connected.push('google_drive');
  if (githubConnected) connected.push('github');
  if (airtableConnected) connected.push('airtable');

  return connected;
}

// Re-export individual services for direct use
export { searchNotion, hasNotionConnected, createNotionPage } from './notion.service';
export { searchGoogleDrive, hasGoogleDriveConnected, listDriveFiles } from './google-drive.service';
export { searchGitHub, hasGitHubConnected, getUserRepos, createGitHubIssue } from './github.service';
export { searchAirtable, hasAirtableConnected, getBasesSummary, createAirtableRecord, updateAirtableRecord } from './airtable.service';
