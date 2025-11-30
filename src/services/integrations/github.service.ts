import { createClient } from '@/lib/supabase/server';

interface GitHubSearchResult {
  id: string;
  type: 'repo' | 'issue' | 'file' | 'commit';
  title: string;
  url: string;
  content: string;
  repo?: string;
  updatedAt: string;
}

/**
 * Get GitHub access token for a user
 */
async function getGitHubToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'github')
    .eq('status', 'active')
    .single();

  if (!integration?.access_token) {
    return null;
  }

  return integration.access_token;
}

/**
 * Search GitHub for relevant content - ONLY user's own repos
 */
export async function searchGitHub(
  userId: string,
  query: string,
  limit: number = 5
): Promise<GitHubSearchResult[]> {
  const accessToken = await getGitHubToken(userId);
  
  if (!accessToken) {
    return [];
  }

  const results: GitHubSearchResult[] = [];

  try {
    // Get user's username first
    const username = await getGitHubUsername(accessToken);
    if (!username) {
      return [];
    }

    // Search only user's own repositories
    const repoResults = await searchUserRepos(accessToken, username, query, Math.ceil(limit / 2));
    results.push(...repoResults);

    // Search issues/PRs in user's repos only
    const issueResults = await searchUserIssues(accessToken, username, query, Math.ceil(limit / 2));
    results.push(...issueResults);

    return results.slice(0, limit);
  } catch (error) {
    console.error('GitHub search error:', error);
    return results;
  }
}

/**
 * Get GitHub username for the authenticated user
 */
async function getGitHubUsername(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.login;
  } catch (error) {
    console.error('Error fetching GitHub user:', error);
    return null;
  }
}

/**
 * Search user's own repositories
 */
async function searchUserRepos(
  accessToken: string,
  username: string,
  query: string,
  limit: number
): Promise<GitHubSearchResult[]> {
  try {
    // Search only in user's repos using user: qualifier
    const searchQuery = `${query} user:${username}`;
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&per_page=${limit}&sort=updated`;
    
    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      // Fallback: get user's repos and filter locally
      return getUserReposFiltered(accessToken, query, limit);
    }

    const data = await res.json();
    
    return (data.items || []).map((repo: any) => ({
      id: repo.id.toString(),
      type: 'repo' as const,
      title: repo.full_name,
      url: repo.html_url,
      content: `Repository: ${repo.full_name}\nDescription: ${repo.description || 'No description'}\nLanguage: ${repo.language || 'N/A'}\nStars: ${repo.stargazers_count}\nLast updated: ${repo.updated_at}`,
      updatedAt: repo.updated_at,
    }));
  } catch (error) {
    console.error('Error searching user repos:', error);
    return [];
  }
}

/**
 * Get user's repos and filter by query
 */
async function getUserReposFiltered(
  accessToken: string,
  query: string,
  limit: number
): Promise<GitHubSearchResult[]> {
  try {
    const res = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return [];

    const repos = await res.json();
    const queryLower = query.toLowerCase();
    
    // Filter repos that match the query
    const filtered = repos.filter((repo: any) => {
      const searchText = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase();
      return searchText.includes(queryLower);
    });

    return filtered.slice(0, limit).map((repo: any) => ({
      id: repo.id.toString(),
      type: 'repo' as const,
      title: repo.full_name,
      url: repo.html_url,
      content: `Repository: ${repo.full_name}\nDescription: ${repo.description || 'No description'}\nLanguage: ${repo.language || 'N/A'}\nStars: ${repo.stargazers_count}\nLast updated: ${repo.updated_at}`,
      updatedAt: repo.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching user repos:', error);
    return [];
  }
}

/**
 * Search issues/PRs only in user's own repos
 */
async function searchUserIssues(
  accessToken: string,
  username: string,
  query: string,
  limit: number
): Promise<GitHubSearchResult[]> {
  try {
    // Search issues/PRs involving the user
    const searchQuery = `${query} involves:${username}`;
    const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${limit}&sort=updated`;
    
    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    
    return (data.items || []).map((issue: any) => {
      const repoUrl = issue.repository_url;
      const repoName = repoUrl ? repoUrl.split('/').slice(-2).join('/') : 'Unknown';
      const isPR = !!issue.pull_request;
      
      return {
        id: issue.id.toString(),
        type: 'issue' as const,
        title: `${isPR ? 'PR' : 'Issue'} #${issue.number}: ${issue.title}`,
        url: issue.html_url,
        content: `${isPR ? 'Pull Request' : 'Issue'} in ${repoName}\nTitle: ${issue.title}\nState: ${issue.state}\nBody: ${(issue.body || '').slice(0, 500)}`,
        repo: repoName,
        updatedAt: issue.updated_at,
      };
    });
  } catch (error) {
    console.error('Error searching user issues:', error);
    return [];
  }
}

/**
 * Get user's repositories
 */
export async function getUserRepos(
  userId: string,
  limit: number = 10
): Promise<GitHubSearchResult[]> {
  const accessToken = await getGitHubToken(userId);
  
  if (!accessToken) {
    return [];
  }

  try {
    const res = await fetch(`https://api.github.com/user/repos?per_page=${limit}&sort=updated`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return [];

    const repos = await res.json();
    
    return repos.map((repo: any) => ({
      id: repo.id.toString(),
      type: 'repo' as const,
      title: repo.full_name,
      url: repo.html_url,
      content: `Repository: ${repo.full_name}\nDescription: ${repo.description || 'No description'}\nLanguage: ${repo.language || 'N/A'}\nStars: ${repo.stargazers_count}`,
      updatedAt: repo.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching user repos:', error);
    return [];
  }
}

/**
 * Check if user has GitHub connected
 */
export async function hasGitHubConnected(userId: string): Promise<boolean> {
  const token = await getGitHubToken(userId);
  return token !== null;
}

// ============================================================================
// Write Operations
// ============================================================================

interface GitHubIssueResult {
  number: number;
  url: string;
  title: string;
}

interface GitHubWriteError {
  error: string;
}

/**
 * Create a new issue in a GitHub repository
 */
export async function createGitHubIssue(
  userId: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<GitHubIssueResult | GitHubWriteError> {
  const accessToken = await getGitHubToken(userId);
  
  if (!accessToken) {
    return { error: 'GitHub is not connected' };
  }

  try {
    // Validate repo format
    if (!repo.includes('/')) {
      return { error: 'Repository must be in format "owner/repo"' };
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: labels || [],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      if (res.status === 404) {
        return { error: `Repository "${repo}" not found or you don't have access` };
      }
      if (res.status === 403) {
        return { error: 'You don\'t have permission to create issues in this repository' };
      }
      return { error: errorData.message || 'Failed to create issue' };
    }

    const issue = await res.json();
    
    return {
      number: issue.number,
      url: issue.html_url,
      title: issue.title,
    };
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    return { error: 'Failed to create issue' };
  }
}

