import { createClient } from '@/lib/supabase/server';

interface DriveSearchResult {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  content: string;
  modifiedTime: string;
}

/**
 * Get Google Drive access token for a user
 */
async function getGoogleToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google_drive')
    .eq('status', 'active')
    .single();

  if (!integration?.access_token) {
    console.log('No Google Drive token found for user:', userId);
    return null;
  }

  return integration.access_token;
}

/**
 * Search Google Drive for relevant files
 */
export async function searchGoogleDrive(
  userId: string,
  query: string,
  limit: number = 5
): Promise<DriveSearchResult[]> {
  const accessToken = await getGoogleToken(userId);
  
  if (!accessToken) {
    return [];
  }

  try {
    // First try to search by name and content
    let results = await searchFiles(accessToken, query, limit);
    
    // If no results, get recent files instead
    if (results.length === 0) {
      console.log('No Google Drive search results, fetching recent files');
      results = await getRecentFiles(accessToken, limit);
    }

    return results;
  } catch (error) {
    console.error('Google Drive search error:', error);
    // Try to at least get recent files on error
    try {
      return await getRecentFiles(accessToken, limit);
    } catch {
      return [];
    }
  }
}

/**
 * Search files by name or content
 */
async function searchFiles(
  accessToken: string,
  query: string,
  limit: number
): Promise<DriveSearchResult[]> {
  // Search by name OR fullText content
  const searchQuery = encodeURIComponent(
    `(name contains '${query}' or fullText contains '${query}') and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${searchQuery}&pageSize=${limit}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,modifiedTime)`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    console.error('Google Drive search failed:', searchRes.status, errorText);
    return [];
  }

  const searchData = await searchRes.json();
  const files = searchData.files || [];

  return processFiles(accessToken, files);
}

/**
 * Get recent files from Google Drive
 */
async function getRecentFiles(
  accessToken: string,
  limit: number
): Promise<DriveSearchResult[]> {
  const searchUrl = `https://www.googleapis.com/drive/v3/files?pageSize=${limit}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,modifiedTime)&q=trashed = false`;

  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    console.error('Google Drive list failed:', res.status);
    return [];
  }

  const data = await res.json();
  const files = data.files || [];

  return processFiles(accessToken, files);
}

/**
 * Process files and get content
 */
async function processFiles(
  accessToken: string,
  files: any[]
): Promise<DriveSearchResult[]> {
  const results: DriveSearchResult[] = [];

  for (const file of files) {
    const content = await getFileContent(accessToken, file.id, file.mimeType, file.name);
    
    results.push({
      id: file.id,
      title: file.name,
      url: file.webViewLink || `https://drive.google.com/file/d/${file.id}`,
      mimeType: file.mimeType,
      content,
      modifiedTime: file.modifiedTime,
    });
  }

  return results;
}

/**
 * Get file content from Google Drive
 */
async function getFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  try {
    // For Google Docs - export as plain text
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      
      const res = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const text = await res.text();
        return `Document: ${fileName}\n\n${text.slice(0, 2000)}`;
      }
    }
    
    // For Google Sheets - export as CSV
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
      
      const res = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const text = await res.text();
        return `Spreadsheet: ${fileName}\n\n${text.slice(0, 2000)}`;
      }
    }

    // For Google Slides - export as plain text
    if (mimeType === 'application/vnd.google-apps.presentation') {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      
      const res = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const text = await res.text();
        return `Presentation: ${fileName}\n\n${text.slice(0, 2000)}`;
      }
    }
    
    // For text files, download directly
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const text = await res.text();
        return `File: ${fileName}\n\n${text.slice(0, 2000)}`;
      }
    }

    // For PDFs and other files, return metadata
    return `File: ${fileName} (${mimeType})`;
  } catch (error) {
    console.error('Error fetching file content:', error);
    return `File: ${fileName}`;
  }
}

/**
 * List all files (for general queries)
 */
export async function listDriveFiles(
  userId: string,
  limit: number = 10
): Promise<DriveSearchResult[]> {
  const accessToken = await getGoogleToken(userId);
  
  if (!accessToken) {
    return [];
  }

  return getRecentFiles(accessToken, limit);
}

/**
 * Check if user has Google Drive connected
 */
export async function hasGoogleDriveConnected(userId: string): Promise<boolean> {
  const token = await getGoogleToken(userId);
  return token !== null;
}
