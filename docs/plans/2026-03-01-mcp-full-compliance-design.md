# MCP Full Protocol Compliance Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to implement this plan task-by-task.

**Goal:** Bring the Web Search MCP Server to full MCP v2025-11-25 compliance with proper architecture, Resources, and Prompts.

**Architecture:** Restructure directories for consistency, add `outputSchema` to tools, implement MCP Resources (server config, session status) and MCP Prompts (research templates), and add `_meta` field support with progress tokens.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk v1.27.1, Node.js 18+

---

## Current State

```
src/
├── index.ts              # MCP server entry
├── search.ts             # search logic (inconsistent location)
├── browser.ts            # browser automation
├── session-manager.ts    # session persistence
├── cache.ts              # caching
├── errors.ts             # error types
├── utils.ts              # utilities
├── tavily.ts             # Tavily API
├── tools/
│   ├── extract.ts        # extract tool handler
│   └── research.ts       # research tool handler
└── content/
    ├── extractor.ts      # content extraction
    ├── article.ts        # readability
    ├── relevance.ts      # TF-IDF scoring
    └── facts.ts          # key facts extraction
```

## Target State

```
src/
├── tools/                    # ALL tool handlers
│   ├── search.ts            # MOVED from root
│   ├── extract.ts           # Already here
│   └── research.ts          # Already here
├── core/                     # Shared infrastructure
│   ├── browser.ts           # MOVED from root
│   ├── session-manager.ts   # MOVED from root
│   ├── cache.ts             # MOVED from root
│   └── errors.ts            # MOVED from root
├── content/                  # Content processing (unchanged)
│   ├── extractor.ts
│   ├── article.ts
│   ├── relevance.ts
│   └── facts.ts
├── resources/                # NEW: MCP Resources
│   ├── index.ts             # Resource handlers
│   ├── server-config.ts     # Server configuration resource
│   └── session-status.ts    # Active sessions resource
├── prompts/                  # NEW: MCP Prompts
│   ├── index.ts             # Prompt handlers
│   └── research-templates.ts # Research prompt templates
├── index.ts                  # Main entry (update capabilities)
├── utils.ts                  # Utilities (unchanged)
└── tavily.ts                 # Tavily API (unchanged)
```

---

## Phase 1: Directory Restructuring

### Task 1.1: Create core/ directory and move infrastructure files

**Files:**
- Create: `src/core/` directory
- Move: `src/browser.ts` → `src/core/browser.ts`
- Move: `src/session-manager.ts` → `src/core/session-manager.ts`
- Move: `src/cache.ts` → `src/core/cache.ts`
- Move: `src/errors.ts` → `src/core/errors.ts`

**Import Path Changes:**
- All imports from `./browser.js` → `./core/browser.js`
- All imports from `./session-manager.js` → `./core/session-manager.js`
- All imports from `./cache.js` → `./core/cache.js`
- All imports from `./errors.js` → `./core/errors.js`

### Task 1.2: Move search.ts to tools/

**Files:**
- Move: `src/search.ts` → `src/tools/search.ts`

**Import Path Changes:**
- In `src/index.ts`: `./search.js` → `./tools/search.js`
- Update internal imports in `search.ts` for core/ paths

### Task 1.3: Update all import statements

**Files to update:**
- `src/index.ts`
- `src/tools/search.ts`
- `src/tools/extract.ts`
- `src/tools/research.ts`
- `src/content/extractor.ts`
- `src/tavily.ts`

---

## Phase 2: Resources Implementation

### Task 2.1: Create resources/index.ts

**Resource Handlers:**
- `ListResourcesRequestSchema` - List available resources
- `ReadResourceRequestSchema` - Read resource content

**Resources to expose:**
1. `config://server` - Server configuration and capabilities
2. `session://status` - Active browser sessions

### Task 2.2: Create resources/server-config.ts

**Resource Definition:**
```typescript
{
  uri: "config://server",
  name: "Server Configuration",
  description: "Server capabilities and settings",
  mimeType: "application/json"
}
```

**Content:**
- Server name and version
- Available tools with their annotations
- Capabilities (tools, resources, prompts)

### Task 2.3: Create resources/session-status.ts

**Resource Definition:**
```typescript
{
  uri: "session://status",
  name: "Active Sessions",
  description: "Information about active browser sessions",
  mimeType: "application/json"
}
```

**Content:**
- Active session count
- Session IDs (truncated for privacy)
- Session ages
- Device profiles in use

### Task 2.4: Update index.ts to register resources

**Changes:**
- Add `resources: {}` to capabilities
- Add `ListResourcesRequestSchema` handler
- Add `ReadResourceRequestSchema` handler

---

## Phase 3: Prompts Implementation

### Task 3.1: Create prompts/index.ts

**Prompt Handlers:**
- `ListPromptsRequestSchema` - List available prompts
- `GetPromptRequestSchema` - Get prompt content

### Task 3.2: Create prompts/research-templates.ts

**Prompts to implement:**

1. **deep-research** - Conduct deep research on a topic
   - Arguments: `topic` (required), `depth` (optional, 1-3)

2. **compare-sources** - Compare information across multiple sources
   - Arguments: `query` (required), `sources` (optional, default 5)

3. **fact-check** - Verify claims and extract supporting evidence
   - Arguments: `claim` (required), `context` (optional)

### Task 3.3: Update index.ts to register prompts

**Changes:**
- Add `prompts: {}` to capabilities
- Add `ListPromptsRequestSchema` handler
- Add `GetPromptRequestSchema` handler

---

## Phase 4: outputSchema Implementation

### Task 4.1: Add outputSchema to search tool

```typescript
outputSchema: {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          description: { type: "string" }
        }
      }
    },
    source: { type: "string", enum: ["google", "duckduckgo", "tavily"] },
    query: { type: "string" },
    session_id: { type: "string" },
    search_time_ms: { type: "number" }
  }
}
```

### Task 4.2: Add outputSchema to extract tool

```typescript
outputSchema: {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["success", "error", "timeout"] },
          formats: { type: "object" },
          extraction_time_ms: { type: "number" }
        }
      }
    },
    session_id: { type: "string" },
    total_time_ms: { type: "number" }
  }
}
```

### Task 4.3: Add outputSchema to research tool

```typescript
outputSchema: {
  type: "object",
  properties: {
    query: { type: "string" },
    focus_topics: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          relevance_score: { type: "number" },
          key_facts: { type: "array" },
          summary: { type: "string" }
        }
      }
    },
    analysis_summary: { type: "object" }
  }
}
```

---

## Phase 5: _meta Field and Progress Tokens

### Task 5.1: Add _meta field support to tool responses

**Implementation:**
- Add optional `_meta` field to tool response type
- Include progress token for long-running operations

### Task 5.2: Add progress notifications for research tool

**Implementation:**
- Send progress notifications during research
- Include progress percentage and current status
- Use `notifications/progress` MCP notification type

---

## Verification Checklist

- [ ] All tool handlers in `src/tools/`
- [ ] All infrastructure in `src/core/`
- [ ] Resources accessible via `config://server` and `session://status`
- [ ] Prompts accessible via `deep-research`, `compare-sources`, `fact-check`
- [ ] All tools have `outputSchema`
- [ ] Server capabilities include `tools`, `resources`, `prompts`
- [ ] Build successful
- [ ] README updated

---

## Files Modified Summary

| File | Action |
|------|--------|
| `src/search.ts` | Move to `src/tools/search.ts` |
| `src/browser.ts` | Move to `src/core/browser.ts` |
| `src/session-manager.ts` | Move to `src/core/session-manager.ts` |
| `src/cache.ts` | Move to `src/core/cache.ts` |
| `src/errors.ts` | Move to `src/core/errors.ts` |
| `src/tools/search.ts` | Create (moved) |
| `src/core/browser.ts` | Create (moved) |
| `src/core/session-manager.ts` | Create (moved) |
| `src/core/cache.ts` | Create (moved) |
| `src/core/errors.ts` | Create (moved) |
| `src/core/index.ts` | Create (barrel export) |
| `src/resources/index.ts` | Create |
| `src/resources/server-config.ts` | Create |
| `src/resources/session-status.ts` | Create |
| `src/prompts/index.ts` | Create |
| `src/prompts/research-templates.ts` | Create |
| `src/index.ts` | Major update (capabilities, handlers) |
| `src/tools/extract.ts` | Update imports |
| `src/tools/research.ts` | Update imports |
| `src/content/extractor.ts` | Update imports |
| `src/tavily.ts` | Update imports |
| `README.md` | Update documentation |
