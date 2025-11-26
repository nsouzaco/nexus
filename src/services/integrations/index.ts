import { searchNotion, hasNotionConnected } from './notion.service';
import { searchGoogleDrive, hasGoogleDriveConnected } from './google-drive.service';
import { searchGitHub, hasGitHubConnected, getUserRepos } from './github.service';
import { searchAirtable, hasAirtableConnected } from './airtable.service';

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
 * Search all connected integrations for relevant content
 */
export async function searchIntegrations(
  userId: string,
  query: string,
  limitPerSource: number = 3
): Promise<IntegrationContext> {
  const connectedIntegrations: string[] = [];
  const results: IntegrationResult[] = [];

  // Check connected integrations and search in parallel
  const [notionConnected, driveConnected, githubConnected, airtableConnected] = await Promise.all([
    hasNotionConnected(userId),
    hasGoogleDriveConnected(userId),
    hasGitHubConnected(userId),
    hasAirtableConnected(userId),
  ]);

  const searchPromises: Promise<void>[] = [];

  // Notion
  if (notionConnected) {
    connectedIntegrations.push('notion');
    searchPromises.push(
      searchNotion(userId, query, limitPerSource).then((notionResults) => {
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
    );
  }

  // Google Drive
  if (driveConnected) {
    connectedIntegrations.push('google_drive');
    searchPromises.push(
      searchGoogleDrive(userId, query, limitPerSource).then((driveResults) => {
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
    );
  }

  // GitHub
  if (githubConnected) {
    connectedIntegrations.push('github');
    searchPromises.push(
      searchGitHub(userId, query, limitPerSource).then((githubResults) => {
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
    );
  }

  // Airtable
  if (airtableConnected) {
    connectedIntegrations.push('airtable');
    searchPromises.push(
      searchAirtable(userId, query, limitPerSource).then((airtableResults) => {
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
    return '';
  }

  const sourceParts = context.results.map((result) => {
    const sourceLabel = getSourceLabel(result.source);
    return `<source type="${result.source}" title="${result.title}" url="${result.url}">
${result.content}
</source>`;
  });

  return sourceParts.join('\n\n');
}

/**
 * Get human-readable source label
 */
function getSourceLabel(source: string): string {
  switch (source) {
    case 'notion':
      return 'Notion';
    case 'google_drive':
      return 'Google Drive';
    case 'github':
      return 'GitHub';
    case 'airtable':
      return 'Airtable';
    default:
      return source;
  }
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
export { searchNotion, hasNotionConnected } from './notion.service';
export { searchGoogleDrive, hasGoogleDriveConnected } from './google-drive.service';
export { searchGitHub, hasGitHubConnected, getUserRepos } from './github.service';
export { searchAirtable, hasAirtableConnected } from './airtable.service';

