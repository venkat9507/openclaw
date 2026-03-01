# Implementation Plan: Uninstall npm openclaw & Use Local Dev Build Only

**Document ID:** local-dev-cli-impl-001
**Created:** 2026-02-11
**Status:** Ready for Execution
**Priority:** High (blocks cron job persistence)

---

## Executive Summary

Replace npm-installed openclaw (which lacks retry config schema) with local dev build. This fixes:

- ❌ Gateway config validation failures ("Unrecognized key: retry")
- ❌ Cron jobs not persisting to jobs.json
- ❌ Permission issues editing /usr/local/bin/openclaw

**Expected Outcome:** Cron jobs persist successfully, all recent changes (cron attribution, backup skill, retry config) available immediately.

---

## Current Environment State

```
npm openclaw version:     2026.2.2-3
npm install location:     /usr/local/lib/node_modules/openclaw
CLI symlink:              /usr/local/bin/openclaw → ../lib/node_modules/openclaw/openclaw.mjs
Local dev location:       /Users/venkatraman/Documents/openclaw-main/dist/entry.js
Local dev git status:     Contains all recent changes (cron, backup, retry config)
Build system:             pnpm + TypeScript
Gateway:                  Currently running from local dev build (confirmed in logs)
```

---

## Implementation Phases

### PHASE 1: Verify Local Build Is Production-Ready

**Duration:** ~5 minutes
**Goal:** Confirm dist/entry.js exists, is compiled, and includes all required code

#### Step 1.1: Check dist directory exists

```bash
ls -lh /Users/venkatraman/Documents/openclaw-main/dist/entry.js
```

**Expected:** File exists, size ~500KB+, recent modification date
**If fails:** Run `cd /Users/venkatraman/Documents/openclaw-main && pnpm build`

#### Step 1.2: Verify entry point structure

```bash
file /Users/venkatraman/Documents/openclaw-main/dist/entry.js
head -20 /Users/venkatraman/Documents/openclaw-main/dist/entry.js
```

**Expected:** Executable JavaScript, starts with shebang or imports
**If fails:** Build compilation issue - contact developer

#### Step 1.3: Test local build runs

```bash
node /Users/venkatraman/Documents/openclaw-main/dist/entry.js --help
```

**Expected:** Shows openclaw help/usage information, no errors
**If fails:** Missing dependencies - run `pnpm install` in project directory

#### Step 1.4: Verify retry config schema in local build

```bash
node /Users/venkatraman/Documents/openclaw-main/dist/entry.js config show | grep -i retry
```

**Expected:** Shows retry configuration keys (not "Unrecognized key" error)
**If fails:** Build doesn't include retry config schema changes - check git status

**Checkpoint:** ✅ All 4 checks pass before proceeding to Phase 2

---

### PHASE 2: Uninstall npm openclaw

**Duration:** ~2 minutes
**Goal:** Remove npm version to avoid confusion and version conflicts

#### Step 2.1: Check current npm global installs

```bash
npm list -g openclaw --depth=0
```

**Expected:** Shows `openclaw@2026.2.2-3` or similar version
**If fails:** Already uninstalled (skip to Phase 3)

#### Step 2.2: Uninstall npm openclaw

```bash
npm uninstall -g openclaw
```

**Expected:** `removed X packages`
**If fails:** Retry with `sudo npm uninstall -g openclaw` (last resort)

#### Step 2.3: Verify uninstall

```bash
npm list -g openclaw --depth=0
which openclaw
```

**Expected:** "npm ERR!" (not found) and `openclaw` command should fail
**If fails:** Check `/usr/local/lib/node_modules/openclaw` still exists - manual cleanup needed:

```bash
sudo rm -rf /usr/local/lib/node_modules/openclaw
```

#### Step 2.4: Verify symlink status

```bash
ls -lh /usr/local/bin/openclaw
file /usr/local/bin/openclaw
```

**Expected:** Dead symlink or file referencing non-existent npm path
**If fails:** Will be replaced in Phase 3

**Checkpoint:** ✅ npm openclaw completely uninstalled

---

### PHASE 3: Create Local Dev CLI Access

**Duration:** ~2 minutes
**Goal:** Make local dev build accessible as system-wide `openclaw` command

#### DECISION POINT: Choose CLI Integration Method

| Option                              | Command                                                                                                                                          | Pros                                     | Cons                      | Risk   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------- | ------ |
| **A: Direct symlink** (RECOMMENDED) | `sudo ln -sf /Users/venkatraman/Documents/openclaw-main/dist/entry.js /usr/local/bin/openclaw`                                                   | Simple, single file, no wrapper overhead | Hardcoded absolute path   | Low    |
| B: Shell wrapper                    | `sudo bash -c 'cat > /usr/local/bin/openclaw << EOF\n#!/bin/bash\nexec node /Users/venkatraman/Documents/openclaw-main/dist/entry.js "$@"\nEOF'` | Clearer intent, easier to modify         | Extra layer               | Low    |
| C: Shell alias                      | `echo 'alias openclaw="node /Users/venkatraman/Documents/openclaw-main/dist/entry.js"' >> ~/.zprofile`                                           | No sudo needed                           | Only in interactive shell | Medium |
| D: pnpm script                      | `cd /Users/venkatraman/Documents/openclaw-main && pnpm openclaw <cmd>`                                                                           | Leverages existing setup                 | Requires cd to project    | Low    |

**Selected:** Option A (Direct symlink) - lowest complexity, highest reliability

#### Step 3.1: Remove stale symlink/file

```bash
sudo rm /usr/local/bin/openclaw
```

**Expected:** Succeeds silently (no error)
**If fails:** File not found (OK, proceed)

#### Step 3.2: Create symlink to local dev build

```bash
sudo ln -sf /Users/venkatraman/Documents/openclaw-main/dist/entry.js /usr/local/bin/openclaw
```

**Expected:** Command succeeds silently
**If fails:** Permission denied - may require passwordless sudo or use brew link alternative

#### Step 3.3: Verify symlink created correctly

```bash
ls -lh /usr/local/bin/openclaw
file /usr/local/bin/openclaw
```

**Expected:** Symlink pointing to `/Users/venkatraman/Documents/openclaw-main/dist/entry.js`
**Example output:**

```
lrwxr-xr-x  1 root  wheel  80 Feb 11 12:00 /usr/local/bin/openclaw -> /Users/venkatraman/Documents/openclaw-main/dist/entry.js
```

**Checkpoint:** ✅ Symlink correctly points to local dev build

---

### PHASE 4: Verify & Test Integration

**Duration:** ~10 minutes
**Goal:** Confirm CLI works, config validation passes, cron persistence works

#### Step 4.1: Test openclaw CLI loads

```bash
openclaw --version
```

**Expected:** Displays version like `2026.2.2-local` or similar
**If fails:** Symlink broken or dist/entry.js missing - go back to Phase 3

#### Step 4.2: Test config schema recognition

```bash
openclaw config show | head -30
```

**Expected:** Shows config without "Unrecognized key" errors
**If fails:** Local build doesn't include retry config schema - check git/build status

#### Step 4.3: Test gateway startup (quick test)

```bash
timeout 5 openclaw gateway run --help || true
```

**Expected:** Shows gateway help without config validation errors
**If fails:** Config issue - check ~/.openclaw/openclaw.json for syntax errors

#### Step 4.4: Kill any running openclaw processes

```bash
pkill -9 -f "node.*openclaw" || true
pkill -9 -f "openclaw-gateway" || true
sleep 2
```

**Expected:** Clears stale processes
**Expected output:** (mostly silent)

#### Step 4.5: Start fresh gateway instance (if needed)

```bash
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
sleep 3
```

**Expected:** Gateway starts without errors
**If fails:** Check `/tmp/openclaw-gateway.log` for errors

#### Step 4.6: Verify gateway recognizes retry config

```bash
grep -i "retry\|config" /tmp/openclaw-gateway.log | head -5
```

**Expected:** Gateway started successfully, no validation errors
**If fails:** Check that ~/.openclaw/openclaw.json has valid JSON syntax

**Checkpoint:** ✅ CLI and gateway integration working

---

### PHASE 5: Test Cron Job Persistence

**Duration:** ~5 minutes
**Goal:** Verify that cron jobs now persist to jobs.json (the original issue)

#### Step 5.1: Check current cron jobs

```bash
cat ~/.openclaw/cron/jobs.json | jq '.jobs | length'
```

**Expected:** Shows current job count (or "0" if empty)
**Note:** Record this number

#### Step 5.2: Create test cron job

```bash
openclaw cron add \
  --schedule "0 14 * * *" \
  --agent-id "research" \
  --kind "message" \
  --content "Test cron job at $(date)" \
  --target "telegram"
```

**Expected:** Shows "Scheduled!" message with job details
**If fails:** Check gateway is running: `lsof -i :18789`

#### Step 5.3: Verify job persisted to jobs.json

```bash
cat ~/.openclaw/cron/jobs.json | jq '.jobs | length'
```

**Expected:** Job count increased by 1
**If fails:** Gateway validation still failing - check logs

#### Step 5.4: List all cron jobs

```bash
openclaw cron list
```

**Expected:** Shows the test job with:

- Schedule: "0 14 \* \* \*"
- Agent: "research"
- Status: "active" or "scheduled"

#### Step 5.5: Verify job structure in JSON

```bash
cat ~/.openclaw/cron/jobs.json | jq '.jobs[-1]' | head -20
```

**Expected:** Valid job object with agentId, kind, content, schedule fields
**If fails:** Job structure corrupted - investigate normalization code

#### Step 5.6: Clean up test job (optional)

```bash
openclaw cron delete <job-id>
# Verify deletion
cat ~/.openclaw/cron/jobs.json | jq '.jobs | length'
```

**Expected:** Job count decreased by 1

**Checkpoint:** ✅ Cron jobs now persist correctly

---

### PHASE 6: Verify Recent Changes Are Available

**Duration:** ~5 minutes
**Goal:** Confirm cron attribution footer, backup skill, and retry config all work

#### Step 6.1: Test /backup skill

```bash
openclaw /backup test-backup-cli
```

**Expected:** Shows "What name..." prompt or creates backup at ~/Desktop/
**If fails:** Workspace skill not loaded - check ~/.openclaw/workspace/skills/backup/

#### Step 6.2: Verify backup skill created archive

```bash
ls -lh ~/Desktop/openclaw-backups-* | tail -1
```

**Expected:** Recent tar.gz file exists (e.g., 20-50MB)
**If fails:** Skill execution failed - check agent logs

#### Step 6.3: Test cron with tool attribution

Create a simple cron job that uses a tool:

```bash
openclaw cron add \
  --schedule "*/30 * * * *" \
  --agent-id "research" \
  --kind "message" \
  --content "Fetch data from API and summarize" \
  --target "telegram"
```

**Expected:** Job scheduled with agent "research" bound

#### Step 6.4: Verify retry config in gateway logs

```bash
grep -i "retry" /tmp/openclaw-gateway.log | head -3
```

**Expected:** Retry configuration loaded without errors
**If fails:** Retry schema not compiled - rebuild with `pnpm build`

**Checkpoint:** ✅ All recent features working

---

## Rollback Procedure

**If Phase 4-5 testing fails and you need to revert:**

### Quick Rollback (back to npm)

```bash
# 1. Remove local symlink
sudo rm /usr/local/bin/openclaw

# 2. Reinstall npm openclaw
npm install -g openclaw@2026.2.2-3

# 3. Verify
which openclaw
openclaw --version
```

### Safety Steps

- Keep this plan handy before executing
- Backup ~/.openclaw/ before making changes: `tar -czf ~/openclaw-backup-$(date +%s).tar.gz ~/.openclaw/`
- Test each phase checkpoint before proceeding to next

---

## Pre-Execution Checklist

- [ ] Read this entire plan
- [ ] Understand all phases (1-6)
- [ ] Backup ~/.openclaw/ directory
- [ ] Backup ~/Documents/openclaw-main/ directory (git status clean)
- [ ] Have terminal open and ready
- [ ] Understand rollback procedure
- [ ] Confirm local dev build path is correct: `/Users/venkatraman/Documents/openclaw-main/dist/entry.js`

---

## Execution Summary

| Phase                 | Steps   | Time   | Checkpoint             |
| --------------------- | ------- | ------ | ---------------------- |
| 1: Verify Build       | 1.1-1.4 | 5 min  | dist/entry.js works    |
| 2: Uninstall npm      | 2.1-2.4 | 2 min  | npm openclaw removed   |
| 3: CLI Access         | 3.1-3.3 | 2 min  | Symlink created        |
| 4: Verify Integration | 4.1-4.6 | 10 min | CLI & gateway working  |
| 5: Cron Persistence   | 5.1-5.6 | 5 min  | Jobs persist to JSON   |
| 6: Recent Changes     | 6.1-6.4 | 5 min  | All features available |

**Total Time:** ~30 minutes
**Risk Level:** Low (reversible, single system file changed)
**Success Criteria:** All 6 checkpoints ✅ pass

---

## Post-Execution Actions

### If Successful ✅

1. Update memory with completion status
2. Test the LinkedIn post cron job that failed originally
3. Verify job appears in jobs.json
4. Confirm attribution footer includes "Processed by X Agent using Y tools"

### If Issues Occur ❌

1. Check `/tmp/openclaw-gateway.log` for errors
2. Run `pnpm build` in local dev directory (rebuild TypeScript)
3. Review Phase 4 Step 4.2 (config schema validation)
4. If unresolvable: execute Rollback Procedure

### Maintenance Going Forward

- When you modify OpenClaw code: run `pnpm build` to compile
- Local build immediately available via `openclaw` CLI
- No npm version conflicts
- All changes live immediately (no npm publish delay)

---

## Related Documents

- Original plan: [Plan: Uninstall npm openclaw & Use Local Dev Build Only]
- Previous session context: [Session summary - Cron job persistence issues]
- CLAUDE.md guidelines: Build/test commands section
- Memory: [Agent Monitoring & Retry Architecture]

---

**Document Status:** Ready for execution
**Last Updated:** 2026-02-11
**Prepared by:** Claude Code
**Approval Required:** User confirmation to proceed with Phase 1
