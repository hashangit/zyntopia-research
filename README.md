# Zyntopia Research MCP Server

A Model Context Protocol (MCP) server that enables reliable web searching, automatic fallback, multi-format content extraction, and automated research workflows.

**MCP Spec Compliant:** v2025-11-25 | **SDK Version:** 1.27.1

## Features

- **3 Tools**: `search`, `extract`, `research`
- **3-tier search fallback**: Google → DuckDuckGo → Tavily API
- **Session persistence**: Reuse browser sessions for better performance
- **Device emulation**: Desktop, mobile, iPhone, Android profiles
- **Proxy support**: Route traffic through proxy servers
- **Multi-format extraction**: Markdown, HTML, article, screenshot
- **Article extraction**: Clean content with readability
- **Automated research**: Search, filter by relevance, and extract key facts
- **Tool Annotations**: Full MCP v2025-11-25 compliance with `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

## MCP Compliance

This server implements the [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25) specification (v2025-11-25) with:

- ✅ **Tool Annotations** - Human-readable titles and behavioral hints
- ✅ **JSON-RPC 2.0** - Via stdio transport
- ✅ **JSON Schema Input Validation** - Full inputSchema for all tools
- ✅ **Proper Error Handling** - McpError with standard error codes
- ✅ **Structured Responses** - Content arrays with type discrimination

## Tools

### `search` - Web Search
Search the web using Google (no API key required).

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional, default: 5): Maximum results (1-10)
- `timeout_ms` (number, optional): Timeout in milliseconds
- `device` (string, optional): Device emulation profile
- `proxy` (string, optional): Proxy server URL
- `session_id` (string, optional): Reuse existing session
- `source_preference` (string, optional): Preferred search source

### `extract` - Content Extraction
Extract structured content from web pages with multiple output formats.

**Parameters:**
- `urls` (array, required): URLs to extract (1-10)
- `formats` (array, optional): Output formats ["markdown", "html", "article", "screenshot"]
- `extract_article` (boolean, optional): Use readability for main content
- `timeout_ms` (number, optional): Timeout per URL
- `wait_for_selector` (string, optional): CSS selector to wait for
- `session_id` (string, optional): Reuse existing session
- `screenshot_options` (object, optional): Screenshot configuration
- `include_metadata` (boolean, optional): Include article metadata

### `research` - Automated Research
Search, auto-browse relevant results, and return structured findings for AI synthesis.

**Parameters:**
- `query` (string, required): Search query
- `focus_topics` (array, required): Topics for relevance filtering (1-10)
- `max_pages` (number, optional): Maximum pages to analyze (default: 10)
- `search_limit` (number, optional): Initial search results (default: 15)
- `relevance_threshold` (number, optional): Minimum relevance score (default: 0.5)
- `extract_facts` (boolean, optional): Extract key facts (default: true)
- `follow_links` (boolean, optional): Follow relevant links (default: true)
- `max_depth` (number, optional): Link depth to follow (default: 1)

## Tool Annotations

Per MCP v2025-11-25, all tools include behavioral annotations:

| Tool | Title | ReadOnly | Destructive | Idempotent | OpenWorld |
|------|-------|----------|-------------|------------|-----------|
| `search` | Web Search | ✅ | ❌ | ❌ | ✅ |
| `extract` | Content Extraction | ✅ | ❌ | ✅ | ✅ |
| `research` | Automated Research | ✅ | ❌ | ❌ | ✅ |

- **ReadOnly**: Tool only reads, doesn't modify state
- **Destructive**: Tool may cause irreversible changes
- **Idempotent**: Same input always produces same output
- **OpenWorld**: Tool interacts with external systems

## Architecture

```
src/
├── index.ts              # MCP server entry
├── tools/
│   ├── extract.ts        # Extract tool handler
│   └── research.ts       # Research tool handler
├── content/
│   ├── extractor.ts      # Content extraction logic
│   ├── article.ts        # Readability article extraction
│   ├── relevance.ts      # Relevance scoring algorithm
│   └── facts.ts          # Key facts extraction
├── session-manager.ts    # Browser session management
├── browser.ts            # Agent-browser CLI integration
├── search.ts             # Search tool logic
├── tavily.ts             # Tavily API fallback
├── utils.ts              # Shared utilities and types
├── errors.ts             # Custom error types
└── cache.ts              # In-memory caching
```

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- agent-browser CLI (auto-installed)

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Build the server:
```bash
pnpm build
```

3. Add the server to your MCP configuration:

For Claude Code (`~/.claude.json`):
```json
{
  "mcpServers": {
    "zyn": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/zyntopia-research/build/index.js"],
      "env": {
        "TAVILY_API_KEY": "your-tavily-api-key-here"
      }
    }
  }
}
```

## Environment Variables

- `TAVILY_API_KEY` (optional): Tavily API key for fallback search

## Usage Examples

### Basic Search
```json
{
  "name": "search",
  "arguments": {
    "query": "latest AI news",
    "limit": 5
  }
}
```

### Search with Device Emulation
```json
{
  "name": "search",
  "arguments": {
    "query": "mobile app design",
    "device": "iphone",
    "limit": 5
  }
}
```

### Extract Content from URLs
```json
{
  "name": "extract",
  "arguments": {
    "urls": ["https://example.com/article"],
    "formats": ["markdown", "article"],
    "extract_article": true
  }
}
```

### Research a Topic
```json
{
  "name": "research",
  "arguments": {
    "query": "climate change effects",
    "focus_topics": ["global warming", "carbon emissions", "renewable energy"],
    "max_pages": 5,
    "extract_facts": true
  }
}
```

## License

MIT
