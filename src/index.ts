#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { validateInput, type SearchInput, type ExtractInput, type ResearchInput } from './utils.js';
import { performEnhancedSearch } from './tools/search.js';
import { performExtract } from './tools/extract.js';
import { performResearch } from './tools/research.js';
import { destroySessionManager } from './core/session-manager.js';
import { destroyCaches } from './core/cache.js';
import { setupResourceHandlers } from './resources/index.js';
import { setupPromptHandlers } from './prompts/index.js';

/**
 * Tool annotations as per MCP spec v2025-11-25
 * These help clients understand tool behavior for better UX
 */
interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

class WebSearchServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'zyn',
        version: '0.3.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    setupResourceHandlers(this.server);
    setupPromptHandlers(this.server);

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      destroyCaches();
      destroySessionManager();
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: 'Search the web using Google (no API key required)',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                minimum: 1,
                maximum: 10,
              },
              timeout_ms: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 30000, max: 120000)',
                minimum: 5000,
                maximum: 120000,
              },
              device: {
                type: 'string',
                enum: ['desktop', 'mobile', 'iphone', 'android'],
                description: 'Device emulation profile (default: desktop)',
              },
              proxy: {
                type: 'string',
                description: 'Proxy server URL (e.g., http://user:pass@host:port)',
              },
              session_id: {
                type: 'string',
                description: 'Reuse existing browser session by ID',
              },
              source_preference: {
                type: 'string',
                enum: ['auto', 'google', 'duckduckgo', 'tavily'],
                description: 'Preferred search source (default: auto)',
              },
            },
            required: ['query'],
          },
          annotations: {
            title: 'Web Search',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
          } as ToolAnnotations,
        },
        {
          name: 'extract',
          description: 'Extract structured content from web pages with multiple output formats (markdown, html, article, screenshot)',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'URLs to extract content from (1-10 URLs)',
                minItems: 1,
                maxItems: 10,
              },
              formats: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['markdown', 'html', 'article', 'screenshot', 'pdf'],
                },
                description: 'Output formats (default: ["markdown"])',
              },
              extract_article: {
                type: 'boolean',
                description: 'Use readability for main content extraction (default: true)',
              },
              timeout_ms: {
                type: 'number',
                description: 'Timeout per URL in milliseconds (default: 30000)',
                minimum: 5000,
                maximum: 120000,
              },
              wait_for_selector: {
                type: 'string',
                description: 'CSS selector to wait for before extraction',
              },
              wait_for_timeout: {
                type: 'number',
                description: 'Time to wait before extraction in ms (default: 10000)',
              },
              session_id: {
                type: 'string',
                description: 'Reuse existing browser session by ID',
              },
              screenshot_options: {
                type: 'object',
                properties: {
                  full_page: { type: 'boolean', description: 'Capture full page (default: false)' },
                  width: { type: 'number', description: 'Viewport width (default: 1920)' },
                  height: { type: 'number', description: 'Viewport height (default: 1080)' },
                },
              },
              include_metadata: {
                type: 'boolean',
                description: 'Include article metadata (author, date, etc.) (default: true)',
              },
            },
            required: ['urls'],
          },
          annotations: {
            title: 'Content Extraction',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
          } as ToolAnnotations,
        },
        {
          name: 'research',
          description: 'Search, auto-browse relevant results, and return structured findings for AI synthesis. Automatically filters by relevance to focus topics.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              focus_topics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Topics to focus on for relevance filtering (1-10 topics)',
                minItems: 1,
                maxItems: 10,
              },
              max_pages: {
                type: 'number',
                description: 'Maximum pages to analyze (default: 10, max: 30)',
                minimum: 1,
                maximum: 30,
              },
              search_limit: {
                type: 'number',
                description: 'Initial search results to fetch (default: 15, max: 30)',
                minimum: 5,
                maximum: 30,
              },
              timeout_ms: {
                type: 'number',
                description: 'Total timeout in milliseconds (default: 120000, max: 300000)',
                minimum: 30000,
                maximum: 300000,
              },
              device: {
                type: 'string',
                enum: ['desktop', 'mobile', 'iphone', 'android'],
                description: 'Device emulation profile (default: desktop)',
              },
              relevance_threshold: {
                type: 'number',
                description: 'Minimum relevance score 0-1 (default: 0.5)',
                minimum: 0,
                maximum: 1,
              },
              extract_facts: {
                type: 'boolean',
                description: 'Extract key facts (dates, stats, quotes) (default: true)',
              },
              follow_links: {
                type: 'boolean',
                description: 'Follow relevant links from pages (default: true)',
              },
              max_depth: {
                type: 'number',
                description: 'Link depth to follow (default: 1, max: 3)',
                minimum: 0,
                maximum: 3,
              },
              session_id: {
                type: 'string',
                description: 'Reuse existing browser session by ID',
              },
            },
            required: ['query', 'focus_topics'],
          },
          annotations: {
            title: 'Automated Research',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
          } as ToolAnnotations,
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};

      if (toolName === 'search') {
        return this.handleSearch(args);
      }

      if (toolName === 'extract') {
        return this.handleExtract(args);
      }

      if (toolName === 'research') {
        return this.handleResearch(args);
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${toolName}`
      );
    });
  }

  private async handleSearch(args: Record<string, unknown>) {
    const validation = validateInput(args.query, args.limit);

    if (!validation.valid) {
      throw new McpError(ErrorCode.InvalidParams, validation.error);
    }

    const searchInput: SearchInput = {
      query: validation.query,
      limit: validation.limit,
      timeout_ms: typeof args.timeout_ms === 'number' ? args.timeout_ms : undefined,
      device: typeof args.device === 'string' ? args.device as SearchInput['device'] : undefined,
      proxy: typeof args.proxy === 'string' ? args.proxy : undefined,
      session_id: typeof args.session_id === 'string' ? args.session_id : undefined,
      source_preference: typeof args.source_preference === 'string'
        ? args.source_preference as SearchInput['source_preference']
        : undefined,
    };

    try {
      const response = await performEnhancedSearch(searchInput);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Search error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleExtract(args: Record<string, unknown>) {
    // Validate URLs
    const urls = args.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'urls must be a non-empty array');
    }

    if (!urls.every(u => typeof u === 'string')) {
      throw new McpError(ErrorCode.InvalidParams, 'All URLs must be strings');
    }

    const extractInput: ExtractInput = {
      urls: urls as string[],
      formats: Array.isArray(args.formats)
        ? args.formats as ExtractInput['formats']
        : ['markdown'],
      extract_article: typeof args.extract_article === 'boolean'
        ? args.extract_article
        : true,
      timeout_ms: typeof args.timeout_ms === 'number' ? args.timeout_ms : undefined,
      wait_for_selector: typeof args.wait_for_selector === 'string'
        ? args.wait_for_selector
        : undefined,
      wait_for_timeout: typeof args.wait_for_timeout === 'number'
        ? args.wait_for_timeout
        : undefined,
      session_id: typeof args.session_id === 'string' ? args.session_id : undefined,
      screenshot_options: typeof args.screenshot_options === 'object' && args.screenshot_options !== null
        ? args.screenshot_options as ExtractInput['screenshot_options']
        : undefined,
      include_metadata: typeof args.include_metadata === 'boolean'
        ? args.include_metadata
        : true,
    };

    try {
      const response = await performExtract(extractInput);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Extract error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleResearch(args: Record<string, unknown>) {
    // Validate query
    if (typeof args.query !== 'string' || !args.query.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'query must be a non-empty string');
    }

    // Validate focus_topics
    const focusTopics = args.focus_topics;
    if (!Array.isArray(focusTopics) || focusTopics.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'focus_topics must be a non-empty array');
    }

    if (!focusTopics.every(t => typeof t === 'string')) {
      throw new McpError(ErrorCode.InvalidParams, 'All focus_topics must be strings');
    }

    const researchInput: ResearchInput = {
      query: args.query as string,
      focus_topics: focusTopics as string[],
      max_pages: typeof args.max_pages === 'number' ? args.max_pages : undefined,
      search_limit: typeof args.search_limit === 'number' ? args.search_limit : undefined,
      timeout_ms: typeof args.timeout_ms === 'number' ? args.timeout_ms : undefined,
      device: typeof args.device === 'string' ? args.device as ResearchInput['device'] : undefined,
      relevance_threshold: typeof args.relevance_threshold === 'number' ? args.relevance_threshold : undefined,
      extract_facts: typeof args.extract_facts === 'boolean' ? args.extract_facts : undefined,
      follow_links: typeof args.follow_links === 'boolean' ? args.follow_links : undefined,
      max_depth: typeof args.max_depth === 'number' ? args.max_depth : undefined,
      session_id: typeof args.session_id === 'string' ? args.session_id : undefined,
    };

    try {
      const response = await performResearch(researchInput);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Research error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Zyntopia Research MCP server running on stdio');
  }
}

const server = new WebSearchServer();
server.run().catch(console.error);
