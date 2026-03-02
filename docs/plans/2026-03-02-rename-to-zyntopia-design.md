# Design: Rename to Zyntopia Research

**Date**: 2026-03-02
**Status**: Approved

## Overview

Rename the MCP server from `web-search` to `zyntopia-research` with a short server name `zyn` for cleaner tool paths.

## Summary

| Item | Current | New |
|------|---------|-----|
| Package name | `web-search` | `zyntopia-research` |
| Server name | `web-search` | `zyn` |
| Tool names | `search`, `extract`, `research` | unchanged |
| Full tool paths | `mcp__web-search__search` | `mcp__zyn__search` |

## Rationale

- `web-search` is too generic and doesn't reflect the product branding
- `zyn` as the server name keeps tool paths short (15 chars vs 24 chars)
- Keeping tool names unchanged maintains clarity for users

## Files to Modify

### 1. `package.json`
- `name`: `web-search` → `zyntopia-research`
- `bin`: `web-search` → `zyn`

### 2. `src/index.ts`
- Server `name` in constructor: `web-search` → `zyn`
- Console log message: Update to "Zyntopia Research MCP server running on stdio"

### 3. `README.md`
- Title: "Web Search MCP Server" → "Zyntopia Research MCP Server"
- Package references: `web-search` → `zyntopia-research`
- MCP config example: server key `web-search` → `zyn`
- Tool path examples: Update to `mcp__zyn__*` format

## User Migration

Users will need to update their MCP config from:
```json
"web-search": { "command": "node", "args": ["..."] }
```
to:
```json
"zyn": { "command": "node", "args": ["..."] }
```

## Tool Names (Unchanged)

| Tool | Full Path | Description |
|------|-----------|-------------|
| `search` | `mcp__zyn__search` | Web search with fallback |
| `extract` | `mcp__zyn__extract` | Content extraction |
| `research` | `mcp__zyn__research` | Automated research |
