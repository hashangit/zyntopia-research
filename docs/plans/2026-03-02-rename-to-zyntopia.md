# Rename to Zyntopia Research Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the MCP server from `web-search` to `zyntopia-research` with short server name `zyn`.

**Architecture:** Simple string replacements across 3 files - package.json, index.ts, and README.md. No logic changes.

**Tech Stack:** TypeScript MCP server, npm package

---

## Task 1: Update package.json

**Files:**
- Modify: `package.json:2,8`

**Step 1: Update package name and bin**

Change lines 2 and 8 in `package.json`:

```json
{
  "name": "zyntopia-research",
  ...
  "bin": {
    "zyn": "./build/index.js"
  },
```

**Step 2: Rebuild to verify**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add package.json
git commit -m "refactor: Rename package to zyntopia-research with zyn binary"
```

---

## Task 2: Update server name in index.ts

**Files:**
- Modify: `src/index.ts:37,442`

**Step 1: Update server constructor name**

Change line 37 in `src/index.ts`:

```typescript
name: 'zyn',
```

**Step 2: Update console log message**

Change line 442 in `src/index.ts`:

```typescript
console.error('Zyntopia Research MCP server running on stdio');
```

**Step 3: Rebuild and verify**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "refactor: Update server name to zyn"
```

---

## Task 3: Update README.md

**Files:**
- Modify: `README.md:1,129-130`

**Step 1: Update title**

Change line 1:

```markdown
# Zyntopia Research MCP Server
```

**Step 2: Update MCP config example**

Change lines 129-130:

```json
{
  "mcpServers": {
    "zyn": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/zyntopia-research/build/index.js"],
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: Update README for zyntopia-research rename"
```

---

## Task 4: Final verification

**Step 1: Clean rebuild**

Run: `pnpm build`
Expected: Build succeeds

**Step 2: Verify server starts**

Run: `node build/index.js --help 2>&1 | head -1`
Expected: "Zyntopia Research MCP server running on stdio" (will hang, Ctrl+C to exit)

**Step 3: Final commit (if any changes)**

```bash
git status
# If clean, no additional commit needed
```

---

## Summary

| Task | Files Changed | Commit Message |
|------|---------------|----------------|
| 1 | `package.json` | Rename package to zyntopia-research |
| 2 | `src/index.ts` | Update server name to zyn |
| 3 | `README.md` | Update README for rename |
| 4 | - | Final verification |
