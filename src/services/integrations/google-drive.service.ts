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
    return null;
  }

  // TODO: Check if token is expired and refresh if needed
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
    // Search for files matching the query
    const searchQuery = encodeURIComponent(`fullText contains '${query}' and trashed = false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${searchQuery}&pageSize=${limit}&fields=files(id,name,mimeType,webViewLink,modifiedTime)`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchRes.ok) {
      console.error('Google Drive search failed:', await searchRes.text());
      return [];
    }

    const searchData = await searchRes.json();
    const files = searchData.files || [];

    const results: DriveSearchResult[] = [];

    for (const file of files) {
      const content = await getFileContent(accessToken, file.id, file.mimeType);
      
      results.push({
        id: file.id,
        title: file.name,
        url: file.webViewLink,
        mimeType: file.mimeType,
        content,
        modifiedTime: file.modifiedTime,
      });
    }

    return results;
  } catch (error) {
    console.error('Google Drive search error:', error);
    return [];
  }
}

/**
 * Get file content from Google Drive
 */
async function getFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  try {
    // For Google Docs, Sheets, Slides - export as plain text
    if (mimeType.includes('google-apps')) {
      let exportMimeType = 'text/plain';
      
      if (mimeType.includes('spreadsheet')) {
        exportMimeType = 'text/csv';
      }

      const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
      
      const res = await fetch(exportUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const text = await res.text();
        return text.slice(0, 2000); // Limit content length
      }
    }
    
    // For text files, download directly
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      
      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const text = await res.text();
        return text.slice(0, 2000);
      }
    }

    // For other files, just return file type info
    return `[File type: ${mimeType}]`;
  } catch (error) {
    console.error('Error fetching file content:', error);
    return '';
  }
}

/**
 * Check if user has Google Drive connected
 */
export async function hasGoogleDriveConnected(userId: string): Promise<boolean> {
  const token = await getGoogleToken(userId);
  return token !== null;
}

