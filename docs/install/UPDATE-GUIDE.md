# OpenClaw Fork Update Guide

**Last Updated:** March 2, 2026
**Fork:** https://github.com/venkat9507/openclaw
**Branch:** `custom-base`

---

## Overview

This guide explains how to update your custom OpenClaw fork when new official versions are released, while preserving all your custom features.

**Your Custom Features:**

- ✅ Attribution footer system (shows agent name + tools used)
- ✅ Retry architecture (3-layer retry with notifications)
- ✅ DuckDuckGo workspace skill fallback (no API key required)
- ✅ Model configuration (OpenAI GPT-5-mini as primary)

---

## Quick Update Command

```bash
# Update to latest official version (run this monthly)
git fetch upstream && \
git checkout custom-base && \
git merge upstream/main && \
pnpm build && \
pnpm tsgo && \
git push origin custom-base
```

**If conflicts occur:** See [Conflict Resolution](#conflict-resolution) section below.

---

## Repository Setup

### Current Configuration

```bash
# Official OpenClaw repository
upstream: https://github.com/openclaw/openclaw.git

# Your fork (custom features)
origin: https://github.com/venkat9507/openclaw.git
```

### Verify Setup

```bash
git remote -v

# Should show:
# origin    https://github.com/venkat9507/openclaw.git (fetch/push)
# upstream  https://github.com/openclaw/openclaw.git (fetch/push)
```

---

## Step-by-Step Update Process

### Step 1: Check for New Versions

```bash
# Fetch latest official releases
git fetch upstream

# See what's new (last 10 commits)
git log upstream/main --oneline -10

# Check version tags
git tag -l | grep "^v2026" | tail -5
```

**Example Output:**

```
abc123 feat: Add voice mode
def456 feat: New AI provider (DeepSeek)
ghi789 fix: Security patch for SSRF
```

---

### Step 2: Compare Your Branch with Upstream

```bash
# See commits you don't have yet
git log custom-base..upstream/main --oneline

# See detailed code differences
git diff custom-base upstream/main --stat
```

---

### Step 3: Merge Latest Official Version

```bash
# Switch to your custom branch
git checkout custom-base

# Merge upstream main into your branch
git merge upstream/main
```

**Possible Outcomes:**

#### ✅ **No Conflicts** (Most Common)

```bash
Auto-merging 47 files
Merge made by the 'ort' strategy.
 47 files changed, 2389 insertions(+), 156 deletions(-)
```

→ Skip to [Step 5](#step-5-test-the-merge)

#### ⚠️ **Conflicts Detected**

```bash
Auto-merging src/agents/tools/web-search.ts
CONFLICT (content): Merge conflict in src/agents/tools/web-search.ts
Automatic merge failed; fix conflicts and then commit the result.
```

→ Continue to [Step 4](#step-4-resolve-conflicts)

---

### Step 4: Resolve Conflicts

When Git detects conflicts, it marks them in files like this:

```typescript
<<<<<<< HEAD (your custom code)
// Your DuckDuckGo workspace skill fallback
function tryLoadWorkspaceWebSearchSkill(workspaceDir: string) {
  const skillPath = path.join(workspaceDir, 'skills/web-search');
  if (!fs.existsSync(skillPath)) return null;
  return runWorkspaceWebSearchSkill(skillPath);
}
=======
// Official added DeepSeek provider
providers.push({
  id: 'deepseek',
  name: 'DeepSeek Search',
  apiKey: config.deepseek?.apiKey,
});
>>>>>>> upstream/main (official code)
```

#### Conflict Resolution Strategy

**Rule 1: Keep Both (Best Option)**

```typescript
// ✅ GOOD: Merge both features
function tryLoadWorkspaceWebSearchSkill(workspaceDir: string) {
  const skillPath = path.join(workspaceDir, "skills/web-search");
  if (!fs.existsSync(skillPath)) return null;
  return runWorkspaceWebSearchSkill(skillPath);
}

// Official DeepSeek provider
providers.push({
  id: "deepseek",
  name: "DeepSeek Search",
  apiKey: config.deepseek?.apiKey,
});
```

**Rule 2: Security Fixes = Always Keep Official**

```typescript
// ✅ GOOD: Keep official security patches
// If official fixed a vulnerability, always use their version
```

**Rule 3: Official Improved Your Feature = Evaluate**

```typescript
// If official added similar feature (e.g., retry logic),
// compare and choose the better implementation
```

#### Resolve Conflicts

```bash
# 1. Open conflicted files
code src/agents/tools/web-search.ts  # or your editor

# 2. Edit files to resolve conflicts
# - Remove conflict markers (<<<<<<, =======, >>>>>>>)
# - Keep both features when possible
# - Test logic makes sense

# 3. Stage resolved files
git add src/agents/tools/web-search.ts

# 4. Check remaining conflicts
git status

# 5. When all conflicts resolved, commit
git commit -m "Merge v2026.X.Y with custom features

Merged official updates:
- Voice mode feature
- DeepSeek AI provider
- Security patches

Preserved custom features:
- DuckDuckGo workspace skill fallback
- Attribution footer system
- Retry architecture with notifications"
```

---

### Step 5: Test the Merge

**Critical: Always test before pushing!**

```bash
# 1. Type-check
pnpm tsgo

# Expected: 0 errors
```

```bash
# 2. Build
pnpm build

# Expected: Clean build
```

```bash
# 3. Run tests
pnpm test

# Expected: All tests pass
```

```bash
# 4. Restart gateway
launchctl stop ai.openclaw.gateway
sleep 3
launchctl start ai.openclaw.gateway

# 5. Check gateway logs
tail -f /tmp/openclaw-gateway.log

# Expected:
# [gateway] agent model: openai/gpt-5-mini
# [gateway] listening on ws://127.0.0.1:18789
```

```bash
# 6. Test with Telegram
# Send a test message: "What is 2+2?"
# Verify:
# ✅ Response received
# ✅ Attribution footer shows
# ✅ No errors in logs
```

---

### Step 6: Push to Your Fork

```bash
# Push merged changes to your fork
git push origin custom-base
```

**Verify on GitHub:**

- Go to https://github.com/venkat9507/openclaw
- Check that custom-base branch updated
- Review commit history

---

## Conflict Resolution Reference

### Common Conflict Scenarios

#### Scenario 1: Official Added New Provider

**Conflict in:** `src/agents/tools/web-search.ts`

**Your Code:**

```typescript
const providers = [workspaceSkill, braveProvider];
```

**Official Code:**

```typescript
const providers = [braveProvider, deepseekProvider, perplexityProvider];
```

**Solution: Merge Both**

```typescript
const providers = [
  workspaceSkill, // Your custom DuckDuckGo skill
  braveProvider,
  deepseekProvider, // Official new provider
  perplexityProvider, // Official new provider
];
```

---

#### Scenario 2: Official Modified Retry Logic

**Conflict in:** `src/agents/tool-retry.ts`

**Your Code:**

```typescript
const maxAttempts = config?.retry?.tool?.maxAttempts ?? 3;
```

**Official Code:**

```typescript
const maxAttempts = resolveToolRetryAttempts(config, toolName);
```

**Solution: Evaluate and Choose**

```typescript
// If official version is more sophisticated, use it
const maxAttempts = resolveToolRetryAttempts(config, toolName);

// But ensure your config still works
// Test that config.retry.tool.maxAttempts is still respected
```

---

#### Scenario 3: Official Changed File You Modified

**Conflict in:** `src/agents/openclaw-tools.ts`

**Solution: Careful Line-by-Line Merge**

```typescript
// Keep your tool retry wrapper
webSearchTool = wrapToolWithRetry(webSearchTool, toolRetryConfig);

// Also keep official's new tool registrations
newOfficialTool = createNewOfficialTool(options);

// Result: Both features work together
```

---

## Rollback Procedures

### If Merge Fails

```bash
# Abort the merge
git merge --abort

# Your branch returns to pre-merge state
git status
# Should show: On branch custom-base, nothing to commit
```

### If Merge Committed But Broken

```bash
# Find the merge commit
git log --oneline -5

# Example output:
# abc123 Merge upstream/main with custom features  ← BAD MERGE
# def456 Previous working commit                   ← GOOD STATE

# Reset to previous working commit
git reset --hard def456

# Force push to remote (overwrites bad merge)
git push origin custom-base --force
```

### If Gateway Won't Start After Update

```bash
# Quick rollback to previous version
git checkout custom-base~1  # Go back 1 commit

# Rebuild
pnpm build

# Restart gateway
launchctl restart ai.openclaw.gateway

# If this works, you know the merge broke something
# Review the merge commit carefully
```

---

## Update Schedule

### Recommended: Monthly Updates

**Why Monthly?**

- ✅ Smaller updates = easier conflict resolution
- ✅ Stay current with security patches
- ✅ Get new features regularly
- ✅ Less divergence from official

**First Monday of Each Month:**

```bash
# 1. Check for updates
git fetch upstream
git log custom-base..upstream/main --oneline

# 2. If updates exist, merge
git checkout custom-base
git merge upstream/main

# 3. Test and push
pnpm build && pnpm tsgo
git push origin custom-base
```

### Major Version Updates

**When OpenClaw releases major version (e.g., v3.0.0):**

```bash
# 1. Create backup tag
git tag backup-before-v3 custom-base
git push origin backup-before-v3

# 2. Read changelog carefully
git log upstream/main --oneline | grep "BREAKING"

# 3. Merge with extra caution
git merge upstream/main

# 4. Extensive testing
pnpm test
# Test all custom features manually
```

---

## Maintenance Checklist

### Before Each Update

- [ ] Commit or stash any uncommitted changes
- [ ] Verify gateway is running correctly
- [ ] Backup current state (optional: `git tag backup-YYYYMMDD`)
- [ ] Read upstream changelog: `git log upstream/main --oneline -20`

### During Update

- [ ] Fetch upstream: `git fetch upstream`
- [ ] Merge: `git merge upstream/main`
- [ ] Resolve conflicts (if any)
- [ ] Commit merge

### After Update

- [ ] Type-check: `pnpm tsgo` → 0 errors
- [ ] Build: `pnpm build` → success
- [ ] Run tests: `pnpm test` → all pass
- [ ] Restart gateway: `launchctl restart ai.openclaw.gateway`
- [ ] Check logs: `tail -f /tmp/openclaw-gateway.log`
- [ ] Test with Telegram: send test message
- [ ] Verify attribution footer shows
- [ ] Verify retry works (optional: simulate network failure)
- [ ] Push to fork: `git push origin custom-base`

---

## Custom Features Documentation

### Current Custom Features (March 2, 2026)

#### 1. Attribution Footer System

**Files:**

- `src/agents/attribution-footer.ts` (NEW)
- `src/agents/subagent-announce.ts` (MODIFIED)
- `src/cron/isolated-agent/run.ts` (MODIFIED)

**What it does:**

- Shows "**Processed by X Agent** using tool1, tool2" on all responses
- Extracts tools from session transcripts
- Applies to subagent completions and cron job deliveries

**Update considerations:**

- If official modifies `subagent-announce.ts`, carefully merge
- Preserve `extractToolsFromSession()` and `buildAttributionFooter()` calls

---

#### 2. Retry Architecture

**Files:**

- `src/infra/retry-tracker.ts` (NEW)
- `src/agents/tool-retry.ts` (NEW)
- `src/agents/subagent-retry.ts` (NEW)
- `src/agents/failure-notification.ts` (NEW)
- `src/agents/monitoring-events.ts` (NEW)
- `src/config/types.agent-defaults.ts` (MODIFIED)
- `src/config/zod-schema.agent-defaults.ts` (MODIFIED)

**What it does:**

- 3-layer retry protection (tools, subagents, agent turns)
- Exponential backoff with jitter
- Failure notifications to Telegram
- Centralized retry state tracking

**Update considerations:**

- If official adds retry logic, compare implementations
- Ensure config schema (`agents.defaults.retry`) remains compatible
- Test retry behavior after updates

---

#### 3. DuckDuckGo Workspace Skill Fallback

**Files:**

- `src/agents/tools/web-search.ts` (MODIFIED)
- `src/agents/openclaw-tools.ts` (MODIFIED)

**What it does:**

- Allows web search without API key
- Uses Python DuckDuckGo script in workspace
- Falls back to official providers if skill not found

**Update considerations:**

- Most likely file to conflict (official adds new search providers)
- Always keep workspace skill check as highest precedence
- Merge new official providers after workspace skill

**Example merge pattern:**

```typescript
// 1. Check workspace skill first (YOUR CODE)
const workspaceSkill = tryLoadWorkspaceWebSearchSkill(workspaceDir);
if (workspaceSkill) return workspaceSkill;

// 2. Then check official providers (OFFICIAL CODE)
if (config.brave?.apiKey) return createBraveProvider(config);
if (config.deepseek?.apiKey) return createDeepSeekProvider(config); // NEW IN UPDATE
if (config.perplexity?.apiKey) return createPerplexityProvider(config);

// 3. Fallback
return null;
```

---

#### 4. Model Configuration

**Files:**

- `~/.openclaw/openclaw.json` (CONFIG)

**What it does:**

- All agents use `openai/gpt-5-mini` as primary model
- Fallback chain: `gemini-3-pro-preview` → `gemini-2.5-flash`
- Response time: 6 seconds (vs 2 minutes with Gemini)

**Update considerations:**

- Config file NOT in git (lives in `~/.openclaw/`)
- Won't conflict during updates
- But new official models may be added to `agents.defaults.models`
- Review new models and update config if desired

---

## Troubleshooting

### "fatal: Not possible to fast-forward, aborting."

**Cause:** Your branch has diverged from upstream.

**Solution:**

```bash
git merge upstream/main --no-ff
# Forces a merge commit instead of fast-forward
```

---

### "CONFLICT (modify/delete)"

**Cause:** You modified a file that official deleted.

**Solution:**

```bash
# If you need the file, keep it
git add path/to/file

# If file is obsolete, delete it
git rm path/to/file

# Then commit
git commit
```

---

### Build Fails After Merge

**Cause:** TypeScript errors from conflicting changes.

**Solution:**

```bash
# See build errors
pnpm build

# Fix TypeScript errors in reported files
# Common issues:
# - Import paths changed
# - Function signatures changed
# - Types renamed

# After fixing
pnpm build
```

---

### Gateway Won't Start

**Check logs:**

```bash
tail -n 100 /tmp/openclaw-gateway.log
```

**Common issues:**

- Missing dependency: `pnpm install`
- Config validation error: Check `~/.openclaw/openclaw.json`
- Port already in use: `lsof -i :18789`

---

## Getting Help

### Check Upstream Changelog

```bash
# Official release notes
git log upstream/main --oneline --grep="feat\|fix" -20

# Breaking changes
git log upstream/main --oneline --grep="BREAKING" -10
```

### Compare with Official

```bash
# See your custom changes
git diff upstream/main custom-base

# See what official changed since your last merge
git log custom-base..upstream/main --oneline
```

### GitHub Resources

- Official repo: https://github.com/openclaw/openclaw
- Your fork: https://github.com/venkat9507/openclaw
- Official issues: https://github.com/openclaw/openclaw/issues
- Official discussions: https://github.com/openclaw/openclaw/discussions

---

## Quick Reference Commands

### Update Commands

```bash
# Check for updates
git fetch upstream && git log custom-base..upstream/main --oneline

# Update to latest
git checkout custom-base && git merge upstream/main

# Test
pnpm build && pnpm tsgo && pnpm test

# Push
git push origin custom-base
```

### Rollback Commands

```bash
# Abort merge
git merge --abort

# Undo last commit
git reset --hard HEAD~1

# Restore file from upstream
git checkout upstream/main -- path/to/file
```

### Status Commands

```bash
# See current branch and status
git status

# See commit history
git log --oneline -10

# See pending conflicts
git diff --name-only --diff-filter=U
```

---

## Update History

| Date       | Version    | Notes                             |
| ---------- | ---------- | --------------------------------- |
| 2026-03-02 | v2026.2.27 | Initial fork with custom features |
| TBD        | vYYYY.M.D  | Future updates...                 |

---

## Success Criteria

After each update, verify:

- ✅ TypeScript: 0 errors (`pnpm tsgo`)
- ✅ Build: Success (`pnpm build`)
- ✅ Tests: All pass (`pnpm test`)
- ✅ Gateway: Starts successfully
- ✅ Attribution footer: Shows on responses
- ✅ Model: OpenAI GPT-5-mini working
- ✅ Web search: DuckDuckGo workspace skill works
- ✅ Retry: Network failures retry automatically
- ✅ Telegram: Bot responds correctly
- ✅ Logs: No errors in gateway log

---

**Document Version:** 1.0
**Last Updated:** March 2, 2026
**Maintained By:** Venkat Raman

**Need help?** Review this guide carefully before updating, and always test thoroughly!
