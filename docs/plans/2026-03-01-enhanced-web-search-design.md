# Enhanced Web Search MCP Server - Design Document

**Date:** 2026-03-01
**Status:** Approved
**Author:** Claude + User collaboration

## Overview

Enhance the existing Web Search MCP Server with three tools instead of one, leveraging the full capabilities of the agent-browser CLI for session persistence, content extraction, and automated research workflows.

## Goals

1. Improve search reliability with session persistence, proxy support, and device emulation
2. Add deep content extraction with multiple output formats
3. Add automated research workflow with smart page selection

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server                           │
├─────────────────┬─────────────────┬─────────────────────┤
│   search tool   │  extract tool   │   research tool     │
│   (enhanced)    │     (new)       │      (new)          │
├─────────────────┴─────────────────┴─────────────────────┤
│              Browser Session Manager                    │
│  - Shared persistent session                            │
│  - Cookie/state persistence                             │
│  - Proxy rotation                                       │
│  - Device emulation profiles                            │
├─────────────────────────────────────────────────────────┤
│              agent-browser CLI                          │
└─────────────────────────────────────────────────────────┘
```

## Tool Definitions

### 1. `search` Tool (Enhanced)

**Purpose:** Web search with automatic fallback and session persistence.

**Input Schema:**
```typescript
{
  query: string,              // required, 1-500 chars
  limit: number,              // default: 5, max: 10
  timeout_ms: number,         // default: 30000, max: 120000
  device: 'desktop' | 'mobile' | 'iphone' | 'android',
  proxy: string,              // optional proxy URL
  session_id: string,         // optional - reuse existing session
  source_preference: 'auto' | 'google' | 'duckduckgo' | 'tavily'
}
```

**Response Schema:**
```typescript
{
  results: [{ title: string, url: string, description: string }],
  source: 'google' | 'duckduckgo' | 'tavily',
  query: string,
  session_id: string,
  session_active: boolean,
  search_time_ms: number,
  captcha_encountered: boolean,
  fallback_used: boolean
}
```

**Fallback Chain:** Google → DuckDuckGo → Tavily API

---

### 2. `extract` Tool (New)

**Purpose:** Extract structured content from web pages with multiple output formats.

**Input Schema:**
```typescript
{
  urls: string[],             // required, 1-10 URLs
  formats: string[],          // ['markdown','html','article','screenshot','pdf'], default: ['markdown']
  extract_article: boolean,   // default: true - use readability for main content
  timeout_ms: number,         // default: 30000 per URL
  wait_for_selector: string,  // CSS selector to wait for before extraction
  wait_for_timeout: number,   // default: 10000ms
  session_id: string,         // optional - reuse existing session
  screenshot_options: {
    full_page: boolean,       // default: false
    width: number,            // default: 1920
    height: number            // default: 1080
  },
  include_metadata: boolean   // default: true
}
```

**Response Schema:**
```typescript
{
  results: [{
    url: string,
    title: string,
    status: 'success' | 'error' | 'timeout',
    formats: {
      markdown?: string,
      article_markdown?: string,
      html?: string,
      screenshot_base64?: string,
      pdf_base64?: string
    },
    metadata?: {
      author?: string,
      publish_date?: string,
      word_count?: number,
      reading_time_minutes?: number
    },
    error?: string,
    extraction_time_ms: number
  }],
  session_id: string,
  total_time_ms: number,
  successful_count: number,
  failed_count: number
}
```

---

### 3. `research` Tool (New)

**Purpose:** Search, auto-browse relevant results, and return structured findings for AI synthesis.

**Input Schema:**
```typescript
{
  query: string,              // required, 1-500 chars
  focus_topics: string[],     // required, 1-10 topics for relevance filtering
  max_pages: number,          // default: 10, max: 30
  search_limit: number,       // default: 15, max: 30 - initial search results
  timeout_ms: number,         // default: 120000, max: 300000
  device: 'desktop' | 'mobile' | 'iphone' | 'android',
  relevance_threshold: number, // default: 0.5, range: 0-1
  extract_facts: boolean,      // default: true
  follow_links: boolean,       // default: true - follow relevant links from pages
  max_depth: number,           // default: 1, max: 3 - link depth to follow
  session_id: string          // optional - reuse existing session
}
```

**Response Schema:**
```typescript
{
  query: string,
  focus_topics: string[],
  findings: [{
    url: string,
    title: string,
    relevance_score: number,      // 0-1
    relevance_reasoning: string,  // Why this page matched
    key_facts: [{
      type: 'statistic' | 'date' | 'quote' | 'definition',
      fact: string,
      context: string,
      confidence: number          // 0-1
    }],
    summary: string,
    markdown: string
  }],
  analysis_summary: {
    total_pages_analyzed: number,
    pages_skipped: number,
    avg_relevance_score: number,
    top_topics_found: string[],
    research_time_ms: number
  },
  search_source: 'google' | 'duckduckgo' | 'tavily'
}
```

**Smart Selection Algorithm:**
1. Perform search (up to `search_limit` results)
2. Quick-scan each result (title + first 500 chars)
3. Score relevance against `focus_topics` using:
   - 30% exact phrase matching
   - 40% keyword frequency
   - 30% TF-IDF cosine similarity
4. Filter pages above `relevance_threshold`
5. Full extract qualifying pages (up to `max_pages`)
6. Optionally follow links (up to `max_depth`)
7. Extract key facts (dates, statistics, quotes)
8. Return structured findings sorted by relevance

---

## Browser Session Manager

**Purpose:** Manage persistent browser sessions across tool calls for performance and state retention.

**Interface:**
```typescript
interface BrowserSession {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  device: string;
  proxy?: string;
  isActive: boolean;
}

interface SessionConfig {
  device?: 'desktop' | 'mobile' | 'iphone' | 'android';
  proxy?: string;
}

class BrowserSessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private maxSessions = 5;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  // Create new session
  async createSession(config: SessionConfig): Promise<string>;

  // Get existing session by ID
  async getSession(id: string): Promise<BrowserSession | null>;

  // Reuse matching session or create new
  async reuseOrCreate(config: SessionConfig): Promise<string>;

  // Close and cleanup session
  async closeSession(id: string): Promise<void>;

  // Cleanup sessions idle > sessionTimeout
  async cleanupExpiredSessions(): Promise<void>;

  // Execute operation within session context
  async executeInSession<T>(
    sessionId: string,
    fn: () => Promise<T>
  ): Promise<T>;
}
```

**Agent-Browser Integration:**
- Uses `--session-name` flag for persistence
- Passes `--device` for mobile emulation
- Passes `--proxy` for proxy support
- Auto-cleanup of expired sessions

---

## Content Extraction

### Article Extraction

Uses `@mozilla/readability` for boilerplate removal:

```typescript
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

function extractArticle(html: string, url: string): {
  title: string;
  content: string;      // Clean HTML
  textContent: string;  // Plain text
  markdown: string;     // Markdown conversion
  metadata: {
    author?: string;
    publish_date?: string;
    reading_time_minutes: number;
    word_count: number;
  };
}
```

### Relevance Scoring

```typescript
function calculateRelevanceScore(
  pageContent: string,
  focusTopics: string[]
): { score: number; reasoning: string } {
  // 1. Exact phrase matching (30% weight)
  const exactMatches = focusTopics.filter(topic =>
    pageContent.toLowerCase().includes(topic.toLowerCase())
  ).length / focusTopics.length;

  // 2. Keyword frequency (40% weight)
  const keywords = focusTopics.flatMap(t => t.toLowerCase().split(' '));
  const keywordFrequency = keywords.filter(kw =>
    pageContent.toLowerCase().includes(kw)
  ).length / keywords.length;

  // 3. TF-IDF cosine similarity (30% weight)
  const tfidfScore = calculateTFIDFSimilarity(pageContent, focusTopics);

  const score = (exactMatches * 0.3) + (keywordFrequency * 0.4) + (tfidfScore * 0.3);

  return {
    score: Math.min(score, 1.0),
    reasoning: `Matched ${exactMatches * focusTopics.length}/${focusTopics.length} topics exactly`
  };
}
```

### Key Facts Extraction

Rule-based extraction of structured facts:

```typescript
function extractKeyFacts(markdown: string): Fact[] {
  const facts: Fact[] = [];

  // Dates: YYYY-MM-DD, Month DD, YYYY, etc.
  // Statistics: X%, $X, X billion/million, X out of Y
  // Quotes: "..." with attribution
  // Definitions: "X is Y", "X means Y"

  return facts.slice(0, 10); // Top 10 facts
}
```

---

## File Structure

```
src/
├── index.ts              # MCP server entry (updated)
├── tools/
│   ├── search.ts         # Enhanced search tool
│   ├── extract.ts        # New extraction tool
│   └── research.ts       # New research tool
├── session-manager.ts    # Browser session management
├── browser.ts            # Agent-browser CLI integration (updated)
├── content/
│   ├── extractor.ts      # Content extraction logic
│   ├── article.ts        # Readability article extraction
│   ├── relevance.ts      # Relevance scoring algorithm
│   └── facts.ts          # Key facts extraction
├── utils.ts              # Shared utilities (updated)
└── tavily.ts             # Tavily fallback (unchanged)
```

---

## New Dependencies

```json
{
  "@mozilla/readability": "^0.5.0",
  "jsdom": "^26.0.0"
}
```

---

## Agent-Browser CLI Usage

### Current (Minimal)
- `open <url>` - Navigate
- `snapshot --json` - Get accessibility tree
- `close` - Close browser

### Enhanced Usage

| Feature | CLI Command | Tool Usage |
|---------|-------------|------------|
| Session persistence | `--session-name <id>` | All tools |
| Device emulation | `--device <name>` | search, research |
| Proxy support | `--proxy <url>` | All tools |
| Screenshot | `screenshot [--full]` | extract |
| PDF | `pdf <path>` | extract |
| JavaScript eval | `eval <code>` | extract |
| Wait for selector | `wait <selector>` | extract |
| Tab management | `tab new/list/close` | research |
| Auth vault | `auth save/login` | Future |
| Network interception | `network route` | Future |

---

## Error Handling

All tools implement graceful degradation:

1. **Partial results:** Return successful extractions even if some URLs fail
2. **Timeout handling:** Per-URL timeouts, not just global
3. **Fallback chains:** Search fallback preserved
4. **Error codes:** Specific error messages with context

```typescript
// Example error response
{
  results: [...],  // Partial successes
  failed_count: 2,
  errors: [
    { url: '...', error: 'Timeout after 30000ms' },
    { url: '...', error: 'HTTP 403: Access denied' }
  ]
}
```

---

## Security Considerations

1. **URL validation:** Only allow http/https protocols
2. **Proxy validation:** Validate proxy URL format, no credentials in URL
3. **Input limits:** Query max 500 chars, URLs max 10, pages max 30
4. **Output limits:** Max 10MB per response (existing)
5. **Session limits:** Max 5 concurrent sessions
6. **Timeout bounds:** Min 5s, max 300s

---

## Implementation Phases

### Phase 1: Foundation
- Browser Session Manager
- Update `search` tool with session support
- Device emulation and proxy support

### Phase 2: Extract Tool
- Content extraction module
- Multi-format output (markdown, HTML, screenshot, PDF)
- Article extraction with readability
- Parallel URL processing

### Phase 3: Research Tool
- Relevance scoring algorithm
- Key facts extraction
- Smart page selection
- Link following

### Phase 4: Polish
- Error handling refinement
- Performance optimization
- Caching layer (optional)
