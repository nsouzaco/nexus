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
 * Search GitHub for relevant content
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
    // Search repositories
    const repoResults = await searchRepos(accessToken, query, Math.ceil(limit / 3));
    results.push(...repoResults);

    // Search issues and PRs
    const issueResults = await searchIssues(accessToken, query, Math.ceil(limit / 3));
    results.push(...issueResults);

    // Search code
    const codeResults = await searchCode(accessToken, query, Math.ceil(limit / 3));
    results.push(...codeResults);

    return results.slice(0, limit);
  } catch (error) {
    console.error('GitHub search error:', error);
    return results;
  }
}

/**
 * Search GitHub repositories
 */
async function searchRepos(
  accessToken: string,
  query: string,
  limit: number
): Promise<GitHubSearchResult[]> {
  try {
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=updated`;
    
    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return [];

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
    console.error('Error searching repos:', error);
    return [];
  }
}

/**
 * Search GitHub issues and PRs
 */
async function searchIssues(
  accessToken: string,
  query: string,
  limit: number
): Promise<GitHubSearchResult[]> {
  try {
    const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=${limit}&sort=updated`;
    
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
    console.error('Error searching issues:', error);
    return [];
  }
}

/**
 * Search GitHub code
 */
async function searchCode(
  accessToken: string,
  query: string,
  limit: number
): Promise<GitHubSearchResult[]> {
  try {
    const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`;
    
    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    
    return (data.items || []).map((item: any) => ({
      id: item.sha,
      type: 'file' as const,
      title: item.path,
      url: item.html_url,
      content: `File: ${item.path}\nRepository: ${item.repository.full_name}\n[Code file - view on GitHub]`,
      repo: item.repository.full_name,
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error searching code:', error);
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

