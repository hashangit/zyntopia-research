import { extractFromUrls, type ExtractorOptions } from '../content/extractor.js';
import {
  type ExtractInput,
  type ExtractResponse,
  type ExtractResult,
  validateTimeout,
} from '../utils.js';
import { getSessionManager } from '../core/session-manager.js';
import type { BrowserConfig } from '../core/browser.js';

/**
 * Perform content extraction from multiple URLs
 */
export async function performExtract(input: ExtractInput): Promise<ExtractResponse> {
  const startTime = Date.now();
  const {
    urls,
    formats = ['markdown'],
    extract_article = true,
    timeout_ms,
    wait_for_selector,
    wait_for_timeout = 10000,
    session_id,
    screenshot_options,
    include_metadata = true,
  } = input;

  // Validate URLs
  if (!urls || urls.length === 0) {
    throw new Error('At least one URL is required');
  }

  if (urls.length > 10) {
    throw new Error('Maximum 10 URLs allowed per request');
  }

  const timeout = validateTimeout(timeout_ms);

  // Get or create session
  const sessionManager = getSessionManager();
  const { sessionId, session } = await sessionManager.getOrCreateSession(session_id);

  const browserConfig: BrowserConfig = {
    sessionId,
  };

  // Build extractor options
  const extractorOptions: Omit<ExtractorOptions, 'url'> = {
    formats,
    extractArticle: extract_article,
    timeoutMs: timeout,
    waitForSelector: wait_for_selector,
    waitForTimeout: wait_for_timeout,
    screenshotOptions: screenshot_options,
    includeMetadata: include_metadata,
    config: browserConfig,
  };

  // Extract content from all URLs
  const results = await extractFromUrls(urls, extractorOptions);

  // Count successes and failures
  const successfulCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status !== 'success').length;

  // Close browser if not using session persistence
  // Note: We keep the session open for potential reuse

  return {
    results,
    session_id: sessionId,
    total_time_ms: Date.now() - startTime,
    successful_count: successfulCount,
    failed_count: failedCount,
  };
}
