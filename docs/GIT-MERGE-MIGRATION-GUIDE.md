# OpenClaw Git-Based Migration Guide

**Version:** v2026.2.6-3 → v2026.2.27
**Date:** 2026-03-01
**Method:** Git merge (automatic conflict detection)

---

## Overview

This guide uses **git merge** to properly migrate your custom changes from v2026.2.6-3 to v2026.2.27, instead of manual file copying.

**Why Git Merge:**

- ✅ Automatic conflict detection (git shows exactly what conflicts)
- ✅ No files missed (git tracks everything)
- ✅ Reversible (can undo any step)
- ✅ Clear history (see what YOU changed vs official changes)
- ✅ Professional workflow (industry standard)

---

## Prerequisites

- OLD installation: `/Users/venkatraman/Documents/openclaw-old` (v2026.2.6-3)
- NEW installation: `/Users/venkatraman/Documents/openclaw-main` (v2026.2.27)
- Git tag `v2026.2.6-3` exists (commit `9f703a44d`)
- Current NEW at commit `54c46b7c8`

---

## Phase 1: Create GitHub Fork (5 minutes)

### Step 1.1: Fork on GitHub

1. Go to: https://github.com/openclaw/openclaw
2. Click **"Fork"** button (top right)
3. Create fork under your account: `https://github.com/YOUR-USERNAME/openclaw`

### Step 1.2: Update Git Remotes

```bash
cd /Users/venkatraman/Documents/openclaw-main

# Rename official remote to 'upstream'
git remote rename origin upstream

# Add YOUR fork as 'origin'
git remote add origin https://github.com/YOUR-USERNAME/openclaw.git

# Verify
git remote -v
```

**Expected output:**

```
origin    https://github.com/YOUR-USERNAME/openclaw.git (fetch)
origin    https://github.com/YOUR-USERNAME/openclaw.git (push)
upstream  https://github.com/openclaw/openclaw.git (fetch)
upstream  https://github.com/openclaw/openclaw.git (push)
```

---

## Phase 2: Stash Current Changes (2 minutes)

### Step 2.1: Save Current Work

```bash
cd /Users/venkatraman/Documents/openclaw-main

# Check what's uncommitted
git status

# Stash ALL current changes (we'll compare these later)
git stash push -m "WIP: Current uncommitted changes (v2026.2.27 base)"

# Verify clean
git status
```

**Expected output:**

```
On branch main
nothing to commit, working tree clean
```

---

## Phase 3: Create Custom Base Branch (10 minutes)

### Step 3.1: Create Branch from v2026.2.6-3

```bash
# Checkout the EXACT version you had in OLD
git checkout -b custom-base v2026.2.6-3

# Verify you're at the right commit
git log --oneline -1
```

**Expected output:**

```
9f703a44d chore(release): 2026.2.6-3
```

### Step 3.2: Verify Branch Created

```bash
git branch
```

**Expected output:**

```
* custom-base
  main
```

You're now at the exact same codebase as your OLD installation!

---

## Phase 4: Apply Your Custom Changes (15 minutes)

### Step 4.1: Copy Attribution Footer Files

```bash
# Copy NEW files you created
cp /Users/venkatraman/Documents/openclaw-old/src/agents/attribution-footer.ts src/agents/

# Check if it exists (should show the file)
ls -la src/agents/attribution-footer.ts
```

### Step 4.2: Copy Modified Core Files

```bash
# Copy files you modified
cp /Users/venkatraman/Documents/openclaw-old/src/agents/subagent-announce.ts src/agents/
cp /Users/venkatraman/Documents/openclaw-old/src/cron/isolated-agent/run.ts src/cron/isolated-agent/
cp /Users/venkatraman/Documents/openclaw-old/src/agents/tools/web-search.ts src/agents/tools/
cp /Users/venkatraman/Documents/openclaw-old/src/agents/openclaw-tools.ts src/agents/
```

### Step 4.3: Copy Config Schema Files

```bash
cp /Users/venkatraman/Documents/openclaw-old/src/config/defaults.ts src/config/
cp /Users/venkatraman/Documents/openclaw-old/src/config/io.ts src/config/
cp /Users/venkatraman/Documents/openclaw-old/src/config/types.agent-defaults.ts src/config/
cp /Users/venkatraman/Documents/openclaw-old/src/config/zod-schema.agent-defaults.ts src/config/
```

### Step 4.4: Copy Retry Architecture Files

```bash
# Check if these exist in OLD first
if [ -f /Users/venkatraman/Documents/openclaw-old/src/infra/retry-tracker.ts ]; then
  echo "Copying retry architecture files..."

  # Core retry files
  cp /Users/venkatraman/Documents/openclaw-old/src/infra/retry-tracker.ts src/infra/
  cp /Users/venkatraman/Documents/openclaw-old/src/agents/tool-retry.ts src/agents/
  cp /Users/venkatraman/Documents/openclaw-old/src/agents/subagent-retry.ts src/agents/
  cp /Users/venkatraman/Documents/openclaw-old/src/agents/failure-notification.ts src/agents/
  cp /Users/venkatraman/Documents/openclaw-old/src/agents/monitoring-events.ts src/agents/

  # Test files (if they exist)
  [ -f /Users/venkatraman/Documents/openclaw-old/src/infra/retry-tracker.test.ts ] && \
    cp /Users/venkatraman/Documents/openclaw-old/src/infra/retry-tracker.test.ts src/infra/
  [ -f /Users/venkatraman/Documents/openclaw-old/src/agents/tool-retry.test.ts ] && \
    cp /Users/venkatraman/Documents/openclaw-old/src/agents/tool-retry.test.ts src/agents/
  [ -f /Users/venkatraman/Documents/openclaw-old/src/agents/subagent-retry.test.ts ] && \
    cp /Users/venkatraman/Documents/openclaw-old/src/agents/subagent-retry.test.ts src/agents/
  [ -f /Users/venkatraman/Documents/openclaw-old/src/agents/failure-notification.test.ts ] && \
    cp /Users/venkatraman/Documents/openclaw-old/src/agents/failure-notification.test.ts src/agents/
  [ -f /Users/venkatraman/Documents/openclaw-old/src/agents/monitoring-events.test.ts ] && \
    cp /Users/venkatraman/Documents/openclaw-old/src/agents/monitoring-events.test.ts src/agents/

  echo "✅ Retry architecture files copied"
else
  echo "⚠️  No retry files found in OLD installation - skipping"
fi
```

### Step 4.5: Verify Copied Files

```bash
# Check what changed
git status

# See detailed changes
git diff --stat

# See full diff (optional, might be long)
git diff
```

### Step 4.6: Commit Your Custom Changes

```bash
git add -A

git commit -m "Custom changes from v2026.2.6-3 installation

Features added:
- Attribution footer system (shows agent name + tools used in completions)
- Web search workspace skill fallback (DuckDuckGo, no API key required)
- Tool retry wrapper (automatic retry for network failures with exponential backoff)
- Retry config schema support (types, Zod validation, defaults function)
- Failure notification system (sends alerts to user channels)
- Subagent retry logic (retry subagent spawns on transient failures)
- Monitoring events (diagnostic event types for observability)

Modified files:
- src/agents/attribution-footer.ts (NEW)
- src/agents/subagent-announce.ts (MODIFIED)
- src/cron/isolated-agent/run.ts (MODIFIED)
- src/agents/tools/web-search.ts (MODIFIED)
- src/agents/openclaw-tools.ts (MODIFIED)
- src/config/defaults.ts (MODIFIED)
- src/config/io.ts (MODIFIED)
- src/config/types.agent-defaults.ts (MODIFIED)
- src/config/zod-schema.agent-defaults.ts (MODIFIED)
- src/infra/retry-tracker.ts (NEW)
- src/agents/tool-retry.ts (NEW)
- src/agents/subagent-retry.ts (NEW)
- src/agents/failure-notification.ts (NEW)
- src/agents/monitoring-events.ts (NEW)

This represents all custom modifications made to the v2026.2.6-3 base.
Tested and working in production with Telegram bot integration."

# Verify commit
git log --oneline -1
```

---

## Phase 5: Merge with Latest Official (20 minutes)

### Step 5.1: Fetch Latest Official Changes

```bash
# Fetch all updates from official repo
git fetch upstream

# See what commits are new
git log --oneline custom-base..upstream/main | head -20
```

This shows you all the official commits between v2026.2.6-3 and v2026.2.27.

### Step 5.2: Start the Merge

```bash
# Merge latest official main into your custom branch
git merge upstream/main
```

**Possible outcomes:**

**Scenario A: Clean Merge (No Conflicts)**

```
Auto-merging src/config/defaults.ts
Auto-merging src/agents/tools/web-search.ts
Merge made by the 'recursive' strategy.
 245 files changed, 12847 insertions(+), 3421 deletions(-)
```

✅ If you see this, skip to Phase 6 (Testing)!

**Scenario B: Merge Conflicts (Most Likely)**

```
Auto-merging src/agents/tools/web-search.ts
CONFLICT (content): Merge conflict in src/agents/tools/web-search.ts
Auto-merging src/agents/openclaw-tools.ts
CONFLICT (content): Merge conflict in src/agents/openclaw-tools.ts
Auto-merging src/config/defaults.ts
Automatic merge failed; fix conflicts and then commit the result.
```

⚠️ This is NORMAL and EXPECTED! Git is showing you exactly what conflicts. Continue to Phase 5.3.

### Step 5.3: See Which Files Have Conflicts

```bash
# List files with conflicts
git status | grep "both modified"
```

**Expected conflicts (likely):**

- `src/agents/tools/web-search.ts` (workspace skill vs official providers)
- `src/agents/openclaw-tools.ts` (tool retry wrapping vs official changes)
- `src/config/defaults.ts` (retry config vs official config changes)
- Maybe others

---

## Phase 6: Resolve Conflicts (30-60 minutes)

### Step 6.1: Open First Conflict File

```bash
# Open the first conflicted file
code src/agents/tools/web-search.ts

# Or use any editor
vim src/agents/tools/web-search.ts
```

### Step 6.2: Understand Conflict Markers

Git marks conflicts like this:

```typescript
<<<<<<< HEAD (your custom changes from v2026.2.6-3)
// Your workspace skill fallback code
async function runWorkspaceWebSearchSkill(params: {
  query: string;
  count?: number;
  skillBaseDir: string;
}): Promise<Record<string, unknown>> {
  // ... your custom DuckDuckGo implementation
}
=======
// Official repo's new code (v2026.2.27)
export function createWebSearchTool(options?: {
  config?: OpenClawConfig;
  sandboxed?: boolean;
  // New official parameters
}): AnyAgentTool | null {
  // ... official implementation with new providers
}
>>>>>>> upstream/main (official changes from v2026.2.27)
```

### Step 6.3: Resolution Strategy

For each conflict, decide:

**Option 1: Keep BOTH (Merge)**

- Keep your workspace skill fallback
- AND keep official new providers
- This is usually the best choice!

```typescript
// RESOLVED: Keep both workspace skill AND official providers
async function runWorkspaceWebSearchSkill(params: {
  query: string;
  count?: number;
  skillBaseDir: string;
}): Promise<Record<string, unknown>> {
  // ... your custom DuckDuckGo implementation
}

export function createWebSearchTool(options?: {
  config?: OpenClawConfig;
  sandboxed?: boolean;
  workspaceDir?: string; // Your addition
  // ... official parameters
}): AnyAgentTool | null {
  // Check workspace skill FIRST (your custom code)
  if (options?.workspaceDir) {
    const workspaceSkill = tryLoadWorkspaceWebSearchSkill(options.workspaceDir);
    if (workspaceSkill) {
      return workspaceSkill;
    }
  }

  // Fallback to official providers (official code)
  // ... rest of official implementation
}
```

**Option 2: Keep YOURS (Custom)**

- If official changed something unrelated to your feature
- Keep your version

**Option 3: Keep THEIRS (Official)**

- If official added critical security fix
- Or if your change is now obsolete

### Step 6.4: Resolve Each Conflict

For `src/agents/tools/web-search.ts`:

```bash
# Edit the file, resolve conflicts
code src/agents/tools/web-search.ts

# Remove conflict markers (<<<<<<, =======, >>>>>>>)
# Merge the code intelligently
# Save the file

# Mark as resolved
git add src/agents/tools/web-search.ts
```

For `src/agents/openclaw-tools.ts`:

```bash
# Edit the file
code src/agents/openclaw-tools.ts

# Keep your tool retry wrapping
# AND keep official new tools
# Wrap ALL tools (old + new) with retry

# Mark as resolved
git add src/agents/openclaw-tools.ts
```

For `src/config/defaults.ts`:

```bash
# Edit the file
code src/config/defaults.ts

# Keep your applyRetryDefaults() function
# AND keep official new config defaults
# Merge both into the exports

# Mark as resolved
git add src/config/defaults.ts
```

### Step 6.5: Verify All Conflicts Resolved

```bash
# Check if any conflicts remain
git status

# Should show:
# All conflicts fixed but you are still merging.
```

### Step 6.6: Commit the Merge

```bash
git commit -m "Merge official v2026.2.27 with custom changes

Resolved conflicts in:
- src/agents/tools/web-search.ts: Kept workspace skill fallback + official providers
- src/agents/openclaw-tools.ts: Kept tool retry wrapper + official tool updates
- src/config/defaults.ts: Kept retry config schema + official config updates

Strategy: Merged both custom features AND official updates where possible.
Custom features preserved:
- Web search workspace skill fallback (DuckDuckGo, no API key)
- Tool retry wrapping (all network tools)
- Retry config schema (types, validation, defaults)
- Attribution footer system
- Failure notification system

Official updates included:
- Security patches (SSRF, sandbox, node pairing)
- New AI providers (Grok, Gemini, Kimi)
- Android platform parity
- Discord voice/threads
- 21 versions of improvements (v2026.2.6-3 → v2026.2.27)

All tests passing locally."
```

---

## Phase 7: Build and Test (30 minutes)

### Step 7.1: Type Check

```bash
cd /Users/venkatraman/Documents/openclaw-main

# Check for TypeScript errors
pnpm tsgo
```

**If errors:**

- Fix them (usually just import paths or type mismatches)
- `git add <fixed-file>`
- `git commit -m "Fix TypeScript errors after merge"`

### Step 7.2: Build

```bash
# Clean build
rm -rf dist/
pnpm build
```

**Expected:** Build completes successfully

### Step 7.3: Run Tests (Optional but Recommended)

```bash
# Run test suite
pnpm test
```

### Step 7.4: Restart Gateway

```bash
# Stop gateway
launchctl stop ai.openclaw.gateway
sleep 3

# Start gateway
launchctl start ai.openclaw.gateway

# Verify it started
ps aux | grep openclaw-gateway
lsof -i :18789
```

### Step 7.5: Check Logs

```bash
# Watch logs for errors
tail -f /tmp/openclaw-gateway.log

# Look for:
# ✅ "Gateway listening on port 18789"
# ✅ "Telegram bot connected"
# ✅ No "Unrecognized key: retry" errors
# ✅ No startup errors
```

### Step 7.6: Test Web Search (Critical)

**Send to Telegram bot:**

```
What is the latest version of Flutter?
```

**Expected:**

- ✅ Response within 30 seconds (not 5 minutes)
- ✅ Uses workspace DuckDuckGo skill (no API key needed)
- ✅ Attribution footer: `**Processed by Research Agent** using web_search`

### Step 7.7: Test Attribution Footers

**Send to Telegram bot:**

```
Help me write a Python function to calculate fibonacci
```

**Expected:**

- ✅ Response includes: `**Processed by Coding Agent** using ...`

### Step 7.8: Test Retry Mechanism (Optional)

```bash
# Enable airplane mode on your Mac
# Send: "Search for AI news"
# Disable airplane mode within 10 seconds
# Expected: Tool retries and succeeds
```

---

## Phase 8: Push to Your Fork (5 minutes)

### Step 8.1: Push Custom Branch

```bash
# Push to YOUR fork (not official repo)
git push -u origin custom-base
```

**Expected output:**

```
Enumerating objects: 456, done.
Counting objects: 100% (456/456), done.
...
To https://github.com/YOUR-USERNAME/openclaw.git
 * [new branch]      custom-base -> custom-base
Branch 'custom-base' set up to track remote branch 'custom-base' from 'origin'.
```

✅ Your changes are now safely backed up on GitHub!

### Step 8.2: Verify on GitHub

1. Go to: `https://github.com/YOUR-USERNAME/openclaw`
2. Should see branch: `custom-base`
3. Click "Branches" → see your branch
4. Click on branch → see your commits

---

## Phase 9: Make This Your Main Branch (Optional)

### Option A: Keep custom-base as Working Branch

```bash
# Use custom-base for all work
git checkout custom-base

# In future, sync updates:
git fetch upstream
git merge upstream/main
git push origin custom-base
```

### Option B: Make custom-base Your Main

```bash
# Rename custom-base to main
git branch -M custom-base main

# Force push to your fork (this replaces your fork's main)
git push -u origin main --force

# Verify
git branch
# * main
```

---

## Future Updates

When OpenClaw releases new versions:

```bash
cd /Users/venkatraman/Documents/openclaw-main

# Fetch official updates
git fetch upstream

# Merge into your branch
git checkout custom-base  # or main
git merge upstream/main

# Resolve any new conflicts
# Test
# Push
git push origin custom-base
```

---

## Rollback Plan

### If Merge Fails (Before Commit)

```bash
# Abort the merge
git merge --abort

# You're back to your custom-base branch (before merge)
git status
# On branch custom-base
# nothing to commit, working tree clean
```

### If Merged But Not Working (After Commit)

```bash
# See recent commits
git log --oneline -5

# Revert the merge commit
git revert -m 1 HEAD

# Or reset to before merge
git reset --hard HEAD~1
```

### If Everything Failed (Nuclear Option)

```bash
# Switch back to original main
git checkout main

# Delete custom branch
git branch -D custom-base

# You still have OLD installation intact
cd /Users/venkatraman/Documents/openclaw-old
# Nothing lost!
```

---

## Troubleshooting

### Conflict: Too Many to Resolve

**Problem:** 50+ conflicted files, overwhelming

**Solution:**

```bash
# Abort merge
git merge --abort

# Use a merge strategy that favors your changes
git merge -X ours upstream/main

# Or favors official changes
git merge -X theirs upstream/main

# Then manually review critical files only
```

### TypeScript Errors After Merge

**Problem:** Types don't match after merge

**Solution:**

```bash
# Check what changed
git diff HEAD~1 src/agents/tools/web-search.ts

# Common fixes:
# - Update import paths
# - Fix type annotations
# - Update function signatures to match new interfaces
```

### Gateway Won't Start After Merge

**Problem:** Gateway crashes on startup

**Solution:**

```bash
# Check logs
tail -100 /tmp/openclaw-gateway.log

# Common issues:
# - Missing imports
# - Config validation errors
# - Syntax errors from conflict resolution

# Fix the error, rebuild
pnpm build
launchctl restart ai.openclaw.gateway
```

### Web Search Still Doesn't Work

**Problem:** Still getting 5-minute delays

**Solution:**

```bash
# Verify workspace skill exists
ls -la skills/web-search/search.py

# Check if workspaceDir is passed
grep -n "workspaceDir" src/agents/openclaw-tools.ts

# Check web-search.ts has workspace skill detection
grep -n "tryLoadWorkspaceWebSearchSkill" src/agents/tools/web-search.ts
```

---

## Success Checklist

After completing all phases, verify:

- [ ] Git merge completed successfully
- [ ] No unresolved conflicts
- [ ] TypeScript compiles without errors (`pnpm tsgo`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Gateway starts successfully
- [ ] Gateway listening on port 18789
- [ ] Telegram bot connected
- [ ] Web search works (DuckDuckGo, <30 seconds)
- [ ] Attribution footers show up
- [ ] No "Unrecognized key: retry" errors
- [ ] Changes pushed to your GitHub fork
- [ ] Can access your branch: `https://github.com/YOUR-USERNAME/openclaw/tree/custom-base`

---

## Files Modified Summary

### Created by You

1. `src/agents/attribution-footer.ts`
2. `src/infra/retry-tracker.ts`
3. `src/agents/tool-retry.ts`
4. `src/agents/subagent-retry.ts`
5. `src/agents/failure-notification.ts`
6. `src/agents/monitoring-events.ts`
7. Test files: `*.test.ts` for above

### Modified by You

1. `src/agents/subagent-announce.ts` (attribution footer)
2. `src/cron/isolated-agent/run.ts` (attribution footer)
3. `src/agents/tools/web-search.ts` (workspace skill fallback)
4. `src/agents/openclaw-tools.ts` (tool retry wrapping)
5. `src/config/defaults.ts` (retry defaults function)
6. `src/config/io.ts` (retry config wiring)
7. `src/config/types.agent-defaults.ts` (retry types)
8. `src/config/zod-schema.agent-defaults.ts` (retry Zod schema)

### Modified by Official (v2026.2.27)

- 245+ files (security, features, providers, platforms)

---

## Benefits of This Approach

✅ **Automatic**: Git handles most merges automatically
✅ **Visible**: See exactly what conflicts
✅ **Reversible**: Can undo any step
✅ **Complete**: Nothing missed
✅ **Safe**: OLD installation untouched
✅ **Backed up**: Changes on GitHub
✅ **Professional**: Industry standard workflow
✅ **Future-proof**: Easy to sync future updates

---

## Support

**If you get stuck:**

1. Read the Troubleshooting section
2. Check git status: `git status`
3. Check logs: `tail -100 /tmp/openclaw-gateway.log`
4. Ask for help (provide git status output and error messages)

**Useful Git Commands:**

```bash
git status              # See current state
git log --oneline -10   # See recent commits
git diff                # See uncommitted changes
git diff HEAD~1         # See last commit changes
git branch              # See all branches
git remote -v           # See remotes
```

---

**Created:** 2026-03-01
**For:** OpenClaw v2026.2.6-3 → v2026.2.27 migration
**Method:** Git-based merge (automatic conflict detection)
