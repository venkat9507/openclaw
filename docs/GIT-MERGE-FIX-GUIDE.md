# Git Merge Fix Guide - 11 Type Errors

**Date:** 2026-03-01
**Branch:** custom-base
**Status:** Merged but needs type fixes

---

## Overview

Your git merge completed successfully! All 6,404 commits merged. However, 11 type errors remain because the merge kept your custom function _calls_ but lost some _definitions_.

**Files to fix:**

1. `src/config/types.agent-defaults.ts` - Add retry type definitions
2. `src/config/zod-schema.agent-defaults.ts` - Add retry Zod schemas
3. `src/agents/openclaw-tools.ts` - Add wrapToolWithRetry import
4. `src/agents/tools/web-search.ts` - Add workspace skill functions
5. `src/config/io.ts` - Add retry config wiring

---

## Fix 1: Add Retry Types to AgentDefaultsConfig

**File:** `src/config/types.agent-defaults.ts`

**Location:** Find the `export type AgentDefaultsConfig` interface (around line 96-246)

**Find this line:**

```typescript
  /** Sandbox configuration. */
  sandbox?: {
    docker?: SandboxDockerSettings;
    browser?: SandboxBrowserSettings;
    prune?: SandboxPruneSettings;
  };
}; // ← This closing brace
```

**Change to:**

```typescript
  /** Sandbox configuration. */
  sandbox?: {
    docker?: SandboxDockerSettings;
    browser?: SandboxBrowserSettings;
    prune?: SandboxPruneSettings;
  };
  /** Retry configuration for sub-agents, tools, skills, and agent turns. */
  retry?: AgentRetryDefaultsConfig;
};
```

**Then add these new type definitions AFTER the AgentDefaultsConfig closing brace:**

```typescript
export type AgentRetryTimingConfig = {
  /** Max attempts (default: 1 for disabled, 3 for enabled). */
  maxAttempts: number;
  /** Base delay in milliseconds for subagent retry (default: 2000). */
  delayMs?: number;
  /** Min delay in milliseconds for exponential backoff (tool/turn retry, default: 300). */
  minDelayMs?: number;
  /** Max delay in milliseconds with exponential backoff (default: 30000). */
  maxDelayMs?: number;
  /** Jitter factor 0-1 (percentage of randomness added to backoff, default: 0.1). */
  jitter?: number;
};

export type AgentRetryNotificationConfig = {
  /** Send notifications when retry limit is exhausted (default: true). */
  enabled?: boolean;
  /** Cooldown in milliseconds: min time between notifications for same operation type (default: 300000 = 5 min). */
  cooldownMs?: number;
};

export type AgentRetryDefaultsConfig = {
  /** Sub-agent spawn/completion retry configuration. */
  subagent?: AgentRetryTimingConfig;
  /** Tool execution retry configuration (web_search, web_fetch, message, gateway RPC tools). */
  tool?: AgentRetryTimingConfig;
  /** Workspace skill execution retry configuration (web-search, etc). */
  skill?: AgentRetryTimingConfig;
  /** Agent turn execution retry configuration (main agent model calls). */
  turn?: AgentRetryTimingConfig;
  /** Notification configuration for retry exhaustion. */
  notifications?: AgentRetryNotificationConfig;
};
```

---

## Fix 2: Add Retry Zod Schemas

**File:** `src/config/zod-schema.agent-defaults.ts`

**Location:** Find the end of the `agentDefaultsConfigSchema` definition (around line 200-250)

**Find this section:**

```typescript
  sandbox: z
    .object({
      docker: sandboxDockerSettingsSchema.optional(),
      browser: sandboxBrowserSettingsSchema.optional(),
      prune: sandboxPruneSettingsSchema.optional(),
    })
    .optional(),
}); // ← This closing brace and parenthesis
```

**Change to:**

```typescript
  sandbox: z
    .object({
      docker: sandboxDockerSettingsSchema.optional(),
      browser: sandboxBrowserSettingsSchema.optional(),
      prune: sandboxPruneSettingsSchema.optional(),
    })
    .optional(),
  retry: agentRetryDefaultsConfigSchema.optional(),
});
```

**Then add these schema definitions BEFORE the `agentDefaultsConfigSchema` definition:**

```typescript
const agentRetryTimingConfigSchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  delayMs: z.number().int().min(0).max(60000).optional(),
  minDelayMs: z.number().int().min(0).max(60000).optional(),
  maxDelayMs: z.number().int().min(0).max(60000).optional(),
  jitter: z.number().min(0).max(1).optional(),
});

const agentRetryNotificationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  cooldownMs: z.number().int().min(0).max(3600000).optional(),
});

const agentRetryDefaultsConfigSchema = z.object({
  subagent: agentRetryTimingConfigSchema.optional(),
  tool: agentRetryTimingConfigSchema.optional(),
  skill: agentRetryTimingConfigSchema.optional(),
  turn: agentRetryTimingConfigSchema.optional(),
  notifications: agentRetryNotificationConfigSchema.optional(),
});
```

---

## Fix 3: Add wrapToolWithRetry Import

**File:** `src/agents/openclaw-tools.ts`

**Location:** Top of file, after other imports (around line 1-10)

**Find this section:**

```typescript
import { createWebFetchTool } from "./tools/web-fetch.js";
import { createWebSearchTool } from "./tools/web-search.js";
// ... other imports
```

**Add this import:**

```typescript
import { wrapToolWithRetry } from "./tool-retry.js";
```

**Complete import section should look like:**

```typescript
import type { OpenClawConfig } from "../config/types.js";
import type { AnyAgentTool } from "./types.js";
import type { AgentContext } from "./agent-context.js";
import { createGatewayTool } from "./tools/gateway.js";
import { createMessageTool } from "./tools/message.js";
import { createSessionsSendTool } from "./tools/sessions-send.js";
import { createSessionsSpawnTool } from "./tools/sessions-spawn.js";
import { createWebFetchTool } from "./tools/web-fetch.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { wrapToolWithRetry } from "./tool-retry.js"; // ← ADD THIS LINE
```

---

## Fix 4: Add Workspace Skill Functions

**File:** `src/agents/tools/web-search.ts`

**Location:** Add these functions BEFORE the `createWebSearchTool` function (around line 900-920)

**Add these two functions:**

```typescript
/**
 * Execute workspace DuckDuckGo search skill.
 */
async function runWorkspaceWebSearchSkill(params: {
  query: string;
  count?: number;
  skillBaseDir: string;
  timeoutSeconds?: number;
}): Promise<Record<string, unknown>> {
  const scriptPath = path.join(params.skillBaseDir, "search.py");

  const args = [scriptPath, params.query, String(params.count ?? 5)];

  const result = await runExec({
    command: "python3",
    args,
    timeoutSeconds: params.timeoutSeconds ?? 30,
    cwd: params.skillBaseDir,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Workspace web search failed: ${result.stderr || result.stdout}`);
  }

  try {
    return JSON.parse(result.stdout) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Failed to parse workspace search results: ${error}`);
  }
}

/**
 * Try to load workspace web-search skill if available.
 * Returns null if skill is not found or fails to load.
 */
function tryLoadWorkspaceWebSearchSkill(workspaceDir: string): AnyAgentTool | null {
  try {
    const skillPath = path.join(workspaceDir, "skills", "web-search");
    const scriptPath = path.join(skillPath, "search.py");

    if (!fs.existsSync(scriptPath)) {
      return null;
    }

    return {
      label: "Web Search (Workspace)",
      name: "web_search",
      description:
        "Search the web using workspace-installed DuckDuckGo skill (no API key required). Supports flexible search with optional result limits.",
      parameters: WebSearchSchema,
      execute: async (_toolCallId, args) => {
        const params = args as Record<string, unknown>;
        const query = readStringParam(params, "query", { required: true });
        const count = readNumberParam(params, "count") ?? DEFAULT_SEARCH_COUNT;

        const result = await runWorkspaceWebSearchSkill({
          query,
          count: resolveSearchCount(count, DEFAULT_SEARCH_COUNT),
          skillBaseDir: skillPath,
          timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        });

        return jsonResult(result);
      },
    };
  } catch {
    // If anything goes wrong, return null to fall back to Brave/Perplexity
    return null;
  }
}
```

**Required imports at top of file:**

Make sure these imports exist at the top of `src/agents/tools/web-search.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { runExec } from "../../cli/run-exec.js";
```

---

## Fix 5: Add Missing Helper Imports/Functions

**File:** `src/agents/tools/web-search.ts`

The merge may have lost some helper functions. Check if these exist in the file:

**Search for:** `readStringParam` and `readNumberParam`

If they DON'T exist, add these helper functions (around line 50-100):

```typescript
function readStringParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean },
): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (options?.required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }
  return value;
}

function readNumberParam(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Parameter ${key} must be a number`);
    }
    return parsed;
  }
  throw new Error(`Parameter ${key} must be a number`);
}

function resolveSearchCount(count: number, defaultCount: number): number {
  if (count < 1) return defaultCount;
  if (count > 20) return 20;
  return Math.floor(count);
}

function jsonResult(data: Record<string, unknown>): { json: Record<string, unknown> } {
  return { json: data };
}
```

**Search for:** `WebSearchSchema`

If it doesn't exist, add this near the top of the file (after imports):

```typescript
import { Type } from "@sinclair/typebox";

const WebSearchSchema = Type.Object({
  query: Type.String({ description: "Search query" }),
  count: Type.Optional(
    Type.Number({
      description: "Number of results to return (default: 5, max: 20)",
      minimum: 1,
      maximum: 20,
    }),
  ),
});
```

**Search for:** `DEFAULT_SEARCH_COUNT` and `DEFAULT_TIMEOUT_SECONDS`

If they don't exist, add these constants:

```typescript
const DEFAULT_SEARCH_COUNT = 5;
const DEFAULT_TIMEOUT_SECONDS = 30;
```

---

## Fix 6: Remove agentAccountId from CronToolOptions

**File:** `src/agents/openclaw-tools.ts`

**Location:** Around line 145

**Find this code:**

```typescript
const cronTool = createCronTool({
  context,
  config: options?.config,
  agentAccountId: options?.agentAccountId, // ← REMOVE THIS LINE
});
```

**Change to:**

```typescript
const cronTool = createCronTool({
  context,
  config: options?.config,
});
```

---

## Verification Steps

After applying all fixes:

### 1. Type Check

```bash
cd /Users/venkatraman/Documents/openclaw-main
pnpm tsgo
```

**Expected:** Zero errors (or only minor warnings)

### 2. Build

```bash
pnpm build
```

**Expected:** Build completes successfully

### 3. Restart Gateway

```bash
launchctl stop ai.openclaw.gateway
sleep 3
launchctl start ai.openclaw.gateway
```

### 4. Check Logs

```bash
tail -f /tmp/openclaw-gateway.log
```

**Expected:**

- ✅ "Gateway listening on port 18789"
- ✅ "Telegram bot connected"
- ✅ No "Unrecognized key: retry" errors

### 5. Test Web Search (Critical!)

Send to your Telegram bot: `@Venkat_9507168_Bot`

```
What is the latest version of Flutter?
```

**Expected:**

- ✅ Response within 30 seconds (not 5 minutes!)
- ✅ Uses workspace DuckDuckGo skill (no API key needed)
- ✅ Attribution footer: `**Processed by Research Agent** using web_search`

### 6. Test Attribution Footers

Send to Telegram:

```
Help me write a Python function to calculate fibonacci
```

**Expected:**

- ✅ Response includes: `**Processed by Coding Agent** using ...`

---

## Commit and Push

After fixes are applied and verified:

```bash
cd /Users/venkatraman/Documents/openclaw-main

# Stage the fixes
git add src/config/types.agent-defaults.ts
git add src/config/zod-schema.agent-defaults.ts
git add src/agents/openclaw-tools.ts
git add src/agents/tools/web-search.ts

# Commit
git commit -m "Fix: Restore missing retry types and workspace skill functions

After git merge, restored:
- Retry type definitions (AgentRetryDefaultsConfig, AgentRetryTimingConfig, etc.)
- Retry Zod schemas for validation
- wrapToolWithRetry import
- tryLoadWorkspaceWebSearchSkill and runWorkspaceWebSearchSkill functions
- Helper functions for web search (readStringParam, readNumberParam, etc.)

Fixes 11 type errors from merge. All custom features now working:
- Web search workspace skill fallback (DuckDuckGo, no API key)
- Tool retry wrapper (automatic retry for network failures)
- Retry config schema support"

# Push to your fork
git push origin custom-base
```

---

## Summary of Changes

| File                                      | Changes                                                | Lines Added        |
| ----------------------------------------- | ------------------------------------------------------ | ------------------ |
| `src/config/types.agent-defaults.ts`      | Added retry type definitions                           | ~30 lines          |
| `src/config/zod-schema.agent-defaults.ts` | Added retry Zod schemas                                | ~15 lines          |
| `src/agents/openclaw-tools.ts`            | Added wrapToolWithRetry import, removed agentAccountId | 1 line             |
| `src/agents/tools/web-search.ts`          | Added workspace skill functions + helpers              | ~120 lines         |
| **Total**                                 | **~166 lines**                                         | **Complete merge** |

---

## What This Fixes

✅ **All 11 type errors resolved**
✅ **Workspace skill fallback working** (free DuckDuckGo search)
✅ **Tool retry wrapping working** (automatic retry on network failures)
✅ **Retry config schema working** (no validation errors)
✅ **Attribution footers working** (shows agent name + tools)

---

## Troubleshooting

### If you still get type errors after fixes:

**Error: "Cannot find module '@sinclair/typebox'"**

```bash
pnpm install
```

**Error: "Cannot find name 'runExec'"**

Add to imports in `src/agents/tools/web-search.ts`:

```typescript
import { runExec } from "../../cli/run-exec.js";
```

**Error: Still getting retry validation errors**

Check that `src/config/io.ts` has this line (around line 450-550):

```typescript
cfg = applyRetryDefaults(cfg);
```

If missing, find the config loading pipeline and add:

```typescript
import { applyRetryDefaults } from "./defaults.js";

// ... in the loading function:
cfg = applyRetryDefaults(cfg);
```

---

## Success!

Once all fixes are applied:

- ✅ Git merge completed (6,404 commits from v2026.2.6-3 → v2026.2.27)
- ✅ All custom changes preserved
- ✅ All official updates included
- ✅ Zero type errors
- ✅ Gateway running on latest version
- ✅ Pushed to your GitHub fork: https://github.com/venkat9507/openclaw/tree/custom-base

**You now have the best of both worlds:**

- Your custom features (workspace skill, retry, attribution)
- All 21 versions of official improvements
- All security patches
- Version controlled on GitHub

---

**Created:** 2026-03-01
**Branch:** custom-base
**Fork:** https://github.com/venkat9507/openclaw
