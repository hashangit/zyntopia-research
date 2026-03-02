import { runAgentBrowser, ensureAgentBrowser, parseOutput, type BrowserConfig } from '../core/browser.js';
import {
  type SearchResult,
  type SearchResponse,
  type SearchInput,
  validateTimeout,
  validateProxy,
} from '../utils.js';
import { searchWithTavily } from '../tavily.js';
import { getSessionManager } from '../core/session-manager.js';

let browserReady = false;

// Time to wait for user to complete CAPTCHA (in ms)
const CAPTCHA_WAIT_MS = 30000; // 30 seconds

// Check for Tavily API key in environment
function getTavilyApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildGoogleSearchUrl(query: string, limit: number): string {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('num', limit.toString());
  return url.toString();
}

function buildDuckDuckGoSearchUrl(query: string): string {
  const url = new URL('https://duckduckgo.com/');
  url.searchParams.set('q', query);
  url.searchParams.set('ia', 'web');
  return url.toString();
}

interface ParsedResult {
  title: string;
  url: string;
  description: string;
}

function parseSnapshotText(snapshotText: string, limit: number): ParsedResult[] {
  const results: ParsedResult[] = [];
  const lines = snapshotText.split('\n');

  let currentTitle = '';
  let currentUrl = '';
  let pendingDescription = '';

  // URLs to filter out (search engine internal links)
  const blockedPatterns = [
    'duckduckgo.com',
    'google.com/search',
    'google.com/webhp',
    'google.com/imgres',
    'googleadservices.com',
    'support.google.com',
    'accounts.google.com',
    'twitter.com/',
    'x.com/',
  ];

  function isBlockedUrl(url: string): boolean {
    return blockedPatterns.some(pattern => url.includes(pattern));
  }

  for (let i = 0; i < lines.length && results.length < limit; i++) {
    const line = lines[i];

    // Look for link with URL pattern: link "title" [ref=eX]:
    const linkMatch = line.match(/link "([^"]+)" \[ref=e\d+\]:/);
    if (linkMatch) {
      // Check next line for URL
      const nextLine = lines[i + 1] || '';
      const urlMatch = nextLine.match(/\/url: (https?:\/\/[^\s]+)/);

      if (urlMatch) {
        const url = urlMatch[1];

        // Filter out internal search engine links
        if (!isBlockedUrl(url)) {

          // If we have a pending result, save it
          if (currentTitle && currentUrl) {
            results.push({
              title: currentTitle,
              url: currentUrl,
              description: pendingDescription.trim(),
            });
          }

          currentTitle = linkMatch[1];
          currentUrl = url;
          pendingDescription = '';
        }
      }
    }

    // Look for text content that could be descriptions
    const textMatch = line.match(/^(\s*)- text: (.+)$/);
    if (textMatch && currentTitle && currentUrl) {
      const text = textMatch[2];
      // Descriptions are usually longer and not UI text
      if (text.length > 40 && !text.includes('Upgrade to') && !text.includes('Try the')) {
        pendingDescription += (pendingDescription ? ' ' : '') + text;
      }
    }
  }

  // Don't forget the last result
  if (currentTitle && currentUrl && results.length < limit) {
    results.push({
      title: currentTitle,
      url: currentUrl,
      description: pendingDescription.trim(),
    });
  }

  return results;
}

interface BrowserSearchOptions {
  config: BrowserConfig;
  waitForCaptcha?: boolean;
  timeout: number;
}

async function tryBrowserSearch(
  searchUrl: string,
  limit: number,
  options: BrowserSearchOptions
): Promise<{ results: SearchResult[]; captchaEncountered: boolean }> {
  const { config, waitForCaptcha = false, timeout } = options;
  let captchaEncountered = false;

  try {
    await runAgentBrowser(['open', searchUrl], timeout, config);

    // If this is Google, wait for potential CAPTCHA completion
    if (waitForCaptcha) {
      console.error('[web-search] Google may show CAPTCHA - waiting for completion...');
      captchaEncountered = true;
      await sleep(CAPTCHA_WAIT_MS);
    }

    const snapshotJson = await runAgentBrowser(['snapshot', '--json'], timeout, config);
    const snapshot = parseOutput(snapshotJson);

    if (typeof snapshot === 'object' && snapshot !== null) {
      const data = snapshot as { data?: { snapshot?: string } };
      if (data.data?.snapshot) {
        return {
          results: parseSnapshotText(data.data.snapshot, limit),
          captchaEncountered,
        };
      }
    }
    return { results: [], captchaEncountered };
  } finally {
    // Only close browser if not using session persistence
    if (!config.sessionId) {
      try {
        await runAgentBrowser(['close'], 10000, config);
      } catch {
        // Ignore close errors
      }
    }
  }
}

export interface EnhancedSearchOptions extends SearchInput {}

export async function performEnhancedSearch(options: EnhancedSearchOptions): Promise<SearchResponse> {
  const startTime = Date.now();
  const {
    query,
    limit = 5,
    timeout_ms,
    device,
    proxy,
    session_id,
    source_preference = 'auto',
  } = options;

  const timeout = validateTimeout(timeout_ms);

  // Validate proxy if provided
  if (proxy && !validateProxy(proxy)) {
    throw new Error('Invalid proxy URL. Must be http:// or https://');
  }

  // Check/install agent-browser if needed
  if (!browserReady) {
    const ensureResult = await ensureAgentBrowser();
    if (!ensureResult.ready) {
      // Browser not available - go straight to Tavily if available
      const tavilyKey = getTavilyApiKey();
      if (tavilyKey) {
        const response = await searchWithTavily(query, limit, tavilyKey);
        return {
          ...response,
          search_time_ms: Date.now() - startTime,
          fallback_used: true,
        };
      }
      throw new Error(ensureResult.instructions);
    }
    browserReady = true;
  }

  // Get or create session
  const sessionManager = getSessionManager();
  const { sessionId, session } = await sessionManager.getOrCreateSession(
    session_id,
    { device, proxy }
  );

  const browserConfig: BrowserConfig = {
    sessionId,
    device,
    proxy,
  };

  let results: SearchResult[] = [];
  let source: 'google' | 'duckduckgo' | 'tavily' = 'google';
  let captchaEncountered = false;
  let fallbackUsed = false;

  // Determine search order based on preference
  const shouldTryGoogle = source_preference === 'auto' || source_preference === 'google';
  const shouldTryDuckDuckGo = source_preference === 'auto' || source_preference === 'duckduckgo';
  const shouldTryTavily = source_preference === 'auto' || source_preference === 'tavily';

  // Tier 1: Try Google (if preferred or auto)
  if (shouldTryGoogle) {
    try {
      const googleUrl = buildGoogleSearchUrl(query, limit);
      const searchResult = await tryBrowserSearch(googleUrl, limit, {
        config: browserConfig,
        waitForCaptcha: true,
        timeout,
      });
      results = searchResult.results;
      captchaEncountered = searchResult.captchaEncountered;

      // Check if we got blocked (Google sorry page has no real results)
      if (results.length === 0) {
        results = []; // Will trigger fallback
        fallbackUsed = true;
      }
    } catch {
      results = [];
      fallbackUsed = true;
    }
  }

  // Tier 2: Try DuckDuckGo if Google failed (and DuckDuckGo is preferred or auto)
  if (results.length === 0 && shouldTryDuckDuckGo) {
    source = 'duckduckgo';
    try {
      const ddgUrl = buildDuckDuckGoSearchUrl(query);
      const searchResult = await tryBrowserSearch(ddgUrl, limit, {
        config: browserConfig,
        timeout,
      });
      results = searchResult.results;

      if (results.length === 0) {
        fallbackUsed = true;
      }
    } catch {
      results = [];
      fallbackUsed = true;
    }
  }

  // Tier 3: Fallback to Tavily API if browser search failed
  if (results.length === 0 && shouldTryTavily) {
    const tavilyKey = getTavilyApiKey();
    if (tavilyKey) {
      source = 'tavily';
      fallbackUsed = true;
      const tavilyResponse = await searchWithTavily(query, limit, tavilyKey);
      return {
        ...tavilyResponse,
        session_id: sessionId,
        session_active: session?.isActive ?? false,
        search_time_ms: Date.now() - startTime,
        captcha_encountered: captchaEncountered,
        fallback_used: fallbackUsed,
      };
    }
  }

  return {
    results,
    source,
    query,
    session_id: sessionId,
    session_active: session?.isActive ?? false,
    search_time_ms: Date.now() - startTime,
    captcha_encountered: captchaEncountered,
    fallback_used: fallbackUsed && source !== 'google',
  };
}

// Backward compatible function for existing code
export async function performSearch(query: string, limit: number): Promise<SearchResponse> {
  return performEnhancedSearch({ query, limit });
}
