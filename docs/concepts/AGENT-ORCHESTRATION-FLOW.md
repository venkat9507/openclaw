# OpenClaw Agent Orchestration Flow

**Analysis Date:** March 1, 2026
**Configuration Location:** `~/.openclaw/openclaw.json`

---

## Directory Structure

```
📁 CONFIGURATION & DATA (Your Setup)
└── ~/.openclaw/                                    ← AGENT CONFIG LIVES HERE
    ├── openclaw.json                              ← Main configuration (agents, channels, tools)
    ├── workspace/                                  ← Main agent workspace
    │   ├── AGENTS.md                              ← Agent orchestration instructions
    │   ├── SOUL.md                                ← Agent personality/behavior
    │   ├── IDENTITY.md                            ← Agent identity
    │   ├── USER.md                                ← User information
    │   ├── TOOLS.md                               ← Tool usage guidelines
    │   ├── HEARTBEAT.md                           ← Heartbeat config
    │   ├── agents/                                ← Subagent workspaces
    │   │   └── openclaw-system/                   ← OpenClaw Admin agent workspace
    │   │       ├── AGENTS.md
    │   │       ├── SOUL.md
    │   │       ├── IDENTITY.md
    │   │       └── ...
    │   └── skills/                                ← Custom skills
    ├── agents/                                     ← Additional agent workspaces
    │   ├── research/                              ← Research agent workspace
    │   ├── coding/                                ← Coding agent workspace
    │   └── cron/                                  ← Cron agent workspace
    ├── subagents/
    │   └── runs.json                              ← Subagent execution tracking
    ├── cron/
    │   └── jobs.json                              ← Cron job definitions
    ├── telegram/                                   ← Telegram session data
    ├── logs/                                       ← Gateway logs
    ├── credentials/                                ← API credentials
    └── sessions/                                   ← Chat session history

📁 SOURCE CODE (Framework Only)
└── /Users/venkatraman/Documents/openclaw-main/    ← FRAMEWORK CODE (NOT YOUR SETUP)
    ├── src/                                        ← OpenClaw source code
    ├── dist/                                       ← Built binaries
    ├── skills/                                     ← Built-in skills (templates)
    └── extensions/                                 ← Plugin templates
```

---

## Agent Orchestration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TELEGRAM USER (You)                             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Incoming message
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     TELEGRAM CHANNEL HANDLER                         │
│                   (src/telegram/ in openclaw-main)                   │
│                                                                       │
│  Config: ~/.openclaw/openclaw.json                                  │
│  {                                                                    │
│    "channels": {                                                     │
│      "telegram": {                                                   │
│        "enabled": true,                                              │
│        "botToken": "7282102947:...",                                 │
│        "dmPolicy": "pairing",                                        │
│        "streamMode": "partial"                                       │
│      }                                                                │
│    }                                                                  │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Route to default agent
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  MAIN AGENT (Orchestrator)                           │
│                "Yexy, the Manager Agent"                             │
│                                                                       │
│  ID: "main"                                                          │
│  Default: true  ← Receives ALL Telegram messages                    │
│  Workspace: ~/.openclaw/workspace/                                  │
│                                                                       │
│  Context Files:                                                      │
│  - AGENTS.md     (orchestration instructions)                        │
│  - SOUL.md       (personality)                                       │
│  - IDENTITY.md   (who you are)                                       │
│  - USER.md       (user info)                                         │
│  - TOOLS.md      (tool guidelines)                                   │
│                                                                       │
│  Capabilities:                                                       │
│  ✅ sessions_spawn   (can spawn subagents)                           │
│  ✅ sessions_send    (can send messages to subagents)                │
│  ✅ message          (can reply to Telegram)                         │
│  ✅ exec             (can run commands)                              │
│  ✅ group:fs         (file operations)                               │
│  ✅ web-search       (web search)                                    │
│  ✅ browser          (browser automation)                            │
│                                                                       │
│  Subagent Policy:                                                    │
│  "allowAgents": ["*"]  ← Can spawn ANY subagent                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                │               │               │
                ▼               ▼               ▼
    ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │  OPENCLAW-ADMIN  │ │    RESEARCH      │ │     CODING       │
    │   Sub-agent      │ │   Sub-agent      │ │   Sub-agent      │
    └──────────────────┘ └──────────────────┘ └──────────────────┘
                │
                ▼
    ┌──────────────────┐
    │      CRON        │
    │   Sub-agent      │
    └──────────────────┘
```

---

## Agent Definitions (from ~/.openclaw/openclaw.json)

### 1. **Main Agent (Orchestrator)** ✅ DEFAULT

```json
{
  "id": "main",
  "default": true,
  "name": "Yexy, the Manager Agent",
  "workspace": "/Users/venkatraman/.openclaw/workspace",
  "subagents": {
    "allowAgents": ["*"]  ← Can spawn ALL subagents
  },
  "tools": {
    "allow": [
      "exec",
      "sessions_spawn",    ← Spawn subagents
      "sessions_send",     ← Send messages to subagents
      "message",           ← Reply to Telegram user
      "group:fs",
      "group:automation",
      "group:memory",
      "group:ui",
      "group:nodes",
      "web-search",
      "browser",
      "coding-agent",
      "gemini",
      ...
    ]
  }
}
```

**Role:**

- Receives ALL Telegram messages (default agent)
- Decides which task to handle directly
- Decides which task to delegate to subagents
- Coordinates responses back to user

---

### 2. **OpenClaw-Admin Sub-agent**

```json
{
  "id": "openclaw-admin",
  "name": "OpenClaw System Agent",
  "workspace": "/Users/venkatraman/.openclaw/workspace/agents/openclaw-system",
  "model": {
    "primary": "google-gemini-cli/gemini-3-pro-preview"
  },
  "tools": {
    "allow": [
      "exec",
      "group:fs",
      "sessions_list",
      "sessions_spawn",  ← Can spawn OTHER subagents
      "web_search",
      "healthcheck",
      "message",
      "browser"
    ],
    "deny": ["video-frames", "weather", "cron"]
  }
}
```

**Role:**

- System administration tasks
- Gateway health checks
- Log analysis
- Version checks

**⚠️ NOTE:** CANNOT spawn subagents itself (no "subagents.allowAgents" config)

---

### 3. **Research Sub-agent**

```json
{
  "id": "research",
  "name": "Research Agent",
  "workspace": "/Users/venkatraman/.openclaw/agents/research",
  "tools": {
    "allow": [
      "web_search",
      "web_fetch",
      "blogwatcher",
      "gemini",
      "group:fs",
      "message",
      "browser"
    ],
    "deny": [
      "sessions_spawn",  ← CANNOT spawn subagents!
      "sessions_send",
      "cron",
      ...
    ]
  }
}
```

**Role:**

- Web research
- Information gathering
- Content analysis

**⚠️ CANNOT spawn subagents** (sessions_spawn denied)

---

### 4. **Coding Sub-agent**

```json
{
  "id": "coding",
  "name": "Coding Agent",
  "workspace": "/Users/venkatraman/.openclaw/agents/coding",
  "tools": {
    "allow": [
      "coding-agent",
      "exec",
      "group:fs",
      "gemini",
      "message",
      "browser"
    ],
    "deny": [
      "sessions_spawn",  ← CANNOT spawn subagents!
      "sessions_send",
      ...
    ]
  }
}
```

**Role:**

- Code writing
- Code analysis
- Execution tasks

**⚠️ CANNOT spawn subagents** (sessions_spawn denied)

---

### 5. **Cron Sub-agent**

```json
{
  "id": "cron",
  "name": "Cron Agent",
  "workspace": "/Users/venkatraman/.openclaw/agents/cron",
  "tools": {
    "allow": [
      "cron",
      "group:fs",
      "message",
      "exec",
      "web_search",
      "browser"
    ],
    "deny": [
      "sessions_spawn",  ← CANNOT spawn subagents!
      "sessions_send",
      ...
    ]
  }
}
```

**Role:**

- Scheduled tasks
- Job management
- Periodic operations

**⚠️ CANNOT spawn subagents** (sessions_spawn denied)

---

## Message Flow Example

### Scenario: User asks "Check the latest version of OpenClaw"

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER (Telegram)                                                   │
│    Message: "Check the latest version of OpenClaw"                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ (Telegram Bot receives message)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. TELEGRAM CHANNEL HANDLER                                          │
│    - Authenticates user (dmPolicy: "pairing")                       │
│    - Routes to default agent: "main"                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MAIN AGENT (Yexy)                                                 │
│    Reads: ~/.openclaw/workspace/AGENTS.md                           │
│    Decision: "This is a system task, delegate to openclaw-admin"    │
│                                                                       │
│    Calls: sessions_spawn                                             │
│    {                                                                  │
│      "agentId": "openclaw-admin",                                    │
│      "task": "Check the latest version of OpenClaw"                  │
│    }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ (Subagent spawned)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. OPENCLAW-ADMIN SUB-AGENT                                          │
│    Workspace: ~/.openclaw/workspace/agents/openclaw-system/         │
│    Reads: openclaw-system/AGENTS.md                                 │
│                                                                       │
│    Execution:                                                         │
│    1. Calls: exec("openclaw --version")  → 2026.2.6-3              │
│    2. Calls: web_search("latest openclaw version")                  │
│    3. Returns result to Main Agent                                   │
│                                                                       │
│    Result: {                                                          │
│      status: "ok",                                                    │
│      output: "Current: 2026.2.6-3, Latest: 2026.2.27"               │
│    }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ (Subagent announces completion)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. MAIN AGENT (Yexy) - Receives Result                              │
│    Processes subagent output                                         │
│    Formats response for user                                         │
│                                                                       │
│    Calls: message                                                     │
│    {                                                                  │
│      "channel": "telegram",                                          │
│      "text": "Current version: 2026.2.6-3\n                          │
│               Latest version: 2026.2.27\n                            │
│               You're 21 versions behind!"                            │
│    }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. TELEGRAM CHANNEL HANDLER                                          │
│    Sends message back to user                                        │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. USER (Telegram)                                                   │
│    Receives: "Current version: 2026.2.6-3..."                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Subagent Execution Tracking

**Location:** `~/.openclaw/subagents/runs.json`

**Purpose:**

- Tracks all spawned subagents
- Stores execution state (pending, running, completed, failed)
- Maintains retry history (after Phase 8 upgrade)
- Manages cleanup policies

**Example Entry:**

```json
{
  "runId": "subagent-abc123",
  "childSessionKey": "agent/openclaw-admin/run-456",
  "requesterSessionKey": "agent/main/session-789",
  "task": "Check the latest version of OpenClaw",
  "createdAt": 1709283600000,
  "startedAt": 1709283601000,
  "endedAt": 1709283605000,
  "outcome": {
    "status": "ok"
  },
  "retryCount": 0,   ← After upgrade: retry attempts
  "retryHistory": []  ← After upgrade: retry logs
}
```

---

## Configuration Files (All in ~/.openclaw/)

### Main Config: `openclaw.json`

```json
{
  "agents": {
    "defaults": {
      "model": {...},
      "retry": {         ← Retry configuration (Phase 8)
        "subagent": {...},
        "tool": {...},
        "notifications": {...}
      }
    },
    "list": [           ← Agent definitions
      { "id": "main", ... },
      { "id": "openclaw-admin", ... },
      ...
    ]
  },
  "channels": {         ← Channel configurations
    "telegram": {...}
  },
  "gateway": {...},     ← Gateway settings
  "cron": {...}         ← Cron configuration
}
```

### Agent Context Files (in each workspace):

**AGENTS.md** - Orchestration Instructions

```markdown
# Agent Orchestration

You are the Main Agent. Your role is to:

- Receive user requests from Telegram
- Decide which tasks to handle directly
- Delegate complex tasks to specialized subagents
- Coordinate responses back to the user

Subagents:

- openclaw-admin: System tasks, logs, health checks
- research: Web research, information gathering
- coding: Code writing, analysis, execution
- cron: Scheduled tasks, job management
```

**SOUL.md** - Agent Personality

```markdown
# Agent Personality

You are Yexy, a helpful manager agent.

- Be concise and professional
- Delegate appropriately
- Provide clear status updates
```

**IDENTITY.md** - Agent Identity

```markdown
# Agent Identity

Name: Yexy
Role: Manager Agent
Owner: Venkat Raman
```

**USER.md** - User Information

```markdown
# User Information

Name: Venkat Raman
Telegram: @venkatraman
Preferences: Concise responses, technical details
```

---

## Key Differences: Source vs Config

| Aspect                | Source Code Location                          | Your Configuration                 |
| --------------------- | --------------------------------------------- | ---------------------------------- |
| **Path**              | `/Users/venkatraman/Documents/openclaw-main/` | `~/.openclaw/`                     |
| **Purpose**           | OpenClaw framework code                       | Your agent setup & data            |
| **Contains**          | TypeScript source, dist, templates            | Config, workspaces, sessions, logs |
| **Agent Definitions** | ❌ No                                         | ✅ Yes (`openclaw.json`)           |
| **Agent Workspaces**  | ❌ No                                         | ✅ Yes (`workspace/`, `agents/`)   |
| **Session Data**      | ❌ No                                         | ✅ Yes (`sessions/`, `subagents/`) |
| **Telegram Config**   | ❌ No                                         | ✅ Yes (`channels.telegram`)       |
| **Cron Jobs**         | ❌ No                                         | ✅ Yes (`cron/jobs.json`)          |
| **Logs**              | ❌ No                                         | ✅ Yes (`logs/gateway.log`)        |
| **When to Modify**    | Only for framework changes                    | Always for your setup              |
| **Git Tracked**       | ❌ No (not a git repo)                        | ❌ No (user data)                  |

---

## Upgrade Impact on Your Setup

### What Changes During Upgrade:

**Source Code (`openclaw-main/`):**

- ✅ src/ - Updated framework code
- ✅ dist/ - Rebuilt binaries
- ✅ Built-in skills templates

**Your Configuration (`~/.openclaw/`):**

- ⚠️ openclaw.json - May need migration (auto-handled)
- ✅ workspace/ - UNCHANGED (your data)
- ✅ agents/ - UNCHANGED (your data)
- ✅ sessions/ - UNCHANGED (your data)
- ✅ cron/jobs.json - UNCHANGED (your data)
- ✅ logs/ - UNCHANGED (your data)

**Safe to Upgrade:** ✅ Your agent orchestration config won't be lost!

---

## Current Issues (Based on Logs)

### 1. **Subagent Timeout (Feb 26)** ❌

**Location:** `~/.openclaw/subagents/runs.json`
**Issue:** Subagent timed out after 60s, no retry, silent failure
**Fix:** Upgrade to 2026.2.25+ (has retry logic + notifications)

**Before (Current):**

```json
{
  "runId": "subagent-xyz",
  "outcome": {
    "status": "timeout",
    "error": "gateway timeout after 60000ms"
  }
  // No retry, no notification
}
```

**After (Upgrade):**

```json
{
  "runId": "subagent-xyz",
  "retryCount": 2,
  "retryHistory": [
    { "attempt": 1, "error": "timeout", "at": 1709283601000 },
    { "attempt": 2, "error": "timeout", "at": 1709283606000 }
  ],
  "outcome": {
    "status": "ok" // Succeeded on retry!
  }
}
```

---

## Summary

### ✅ **Your Setup Lives in:** `~/.openclaw/`

**Configuration:**

- `openclaw.json` - Agent definitions, channels, tools, retry config

**Workspaces:**

- `workspace/` - Main agent (Yexy) workspace
- `workspace/agents/openclaw-system/` - OpenClaw-admin workspace
- `agents/research/` - Research agent workspace
- `agents/coding/` - Coding agent workspace
- `agents/cron/` - Cron agent workspace

**Runtime Data:**

- `subagents/runs.json` - Subagent execution tracking
- `cron/jobs.json` - Cron job definitions
- `telegram/` - Telegram session data
- `sessions/` - Chat history
- `logs/` - Gateway logs

### ❌ **Framework Code Lives in:** `/Users/venkatraman/Documents/openclaw-main/`

**Source Code:**

- `src/` - TypeScript source
- `dist/` - Built binaries (what runs)
- Templates only, NOT your setup

---

## Next Steps

1. **Backup Your Setup** ✅

```bash
tar -czf ~/openclaw-backup-$(date +%Y%m%d).tar.gz ~/.openclaw/
```

2. **Upgrade Framework** ✅

```bash
cd /Users/venkatraman/Documents
git clone https://github.com/openclaw/openclaw.git openclaw-new
cd openclaw-new
pnpm install && pnpm build
```

3. **Restart Gateway** ✅

```bash
pkill -TERM openclaw-gateway
pnpm openclaw gateway run
```

4. **Your Config Stays Intact** ✅
   `~/.openclaw/openclaw.json` - No manual changes needed!

---

**Generated:** March 1, 2026
**Your Setup:** 5 agents (main + 4 subagents) with Telegram integration
**Gateway:** Running locally on port 18789
**Main Agent:** Yexy (default, orchestrator)
**Subagents:** openclaw-admin, research, coding, cron
