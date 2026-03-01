# Changelog — 2026-02-10

## Summary of Changes

This session addressed three major areas:

### 1. Cron Job Delivery Attribution Footer ✅

**Problem:** Cron isolated jobs delivered output to user channels (Telegram, etc.) but lacked the `**Processed by X Agent**` attribution footer that sub-agent results include. Users couldn't tell which agent ran the cron job or what tools were used.

**Solution:** Added attribution footer generation to `src/cron/isolated-agent/run.ts` lines 472-498:

- Reads session transcript to extract tool names via `extractToolNamesFromMessages()`
- Builds agent label from `agentConfigOverride?.name` or derives from `agentId`
- Appends footer: `\n\n**Processed by X Agent** using tool1, tool2`
- Works for ALL agents (research, coding, cron, main, etc.)
- Graceful fallback if transcript is unreadable (best-effort)

**Files modified:**

- `src/cron/isolated-agent/run.ts` — Added attribution footer generation (lines 472-498)
- `src/cron/isolated-agent.skips-delivery-without-whatsapp-recipient-besteffortdeliver-true.test.ts` — Updated test assertion to match HTML-escaped footer in Telegram output

**Impact:** Cron deliveries now match sub-agent announce behavior, providing consistent attribution across all autonomous agent execution paths.

---

### 2. Cron Payload Validation & Normalization Fixes ✅

**Problem 1: Schema Mismatch**

- `CronDeliverySchema` had `additionalProperties: false` but was missing the `accountId` field that the TypeScript type `CronDelivery` and cron service both use
- Gateway rejected valid cron payloads with error: `"unexpected property 'accountId'"`

**Solution:**

- Added `accountId: Type.Optional(Type.String())` to both `CronDeliverySchema` and `CronDeliveryPatchSchema` in `src/gateway/protocol/schema/cron.ts`
- Aligns JSON Schema validation with TypeScript types and runtime usage

**Problem 2: Gemini-Generated Invalid Payloads**

- Gemini AI constructs cron payloads with wrong property names:
  - `agentId` inside `payload` (should be top-level)
  - Non-standard `kind` values (e.g., `agent_turn` with underscores)
  - Cross-contaminated content fields (`message` in systemEvent, `text` in agentTurn)

**Solution:**

- Updated `coercePayload()` in `src/cron/normalize.ts`:
  - Delete `payload.agentId` (hoist handled by caller)
  - Normalize `kind` aggressively (strip underscores, hyphens, spaces before matching)
  - Fix cross-contaminated content fields based on kind (swap `message`↔`text`)
- Updated `normalizeCronJobInput()` to hoist misplaced `agentId` from payload to top-level
- Updated `coerceDelivery()` to handle `accountId` trimming

**Files modified:**

- `src/gateway/protocol/schema/cron.ts` — Added `accountId` to delivery schemas
- `src/cron/normalize.ts` — Enhanced payload coercion and content field normalization

**Impact:** Gateway no longer rejects valid cron.add payloads; Gemini-generated payloads with malformed properties are auto-corrected.

---

### 3. `/backup` Slash Command Skill ✅

**Feature:** New workspace skill to back up both `~/.openclaw/` (config) and `/Users/venkatraman/Documents/openclaw-main/` (source) into a single compressed tar.gz archive.

**Design:**

- Naming: `openclaw-backups-<user-name>-<YYYY-MM-DD-HH-MM-SS>.tar.gz`
  - Example: `openclaw-backups-before-refactor-2026-02-10-16-19-24.tar.gz`
- Destination: `~/Desktop/`
- Excludes: `node_modules/`, `dist/`, `.git/objects/`, `*.pyc`, `__pycache__/`
- User interaction: Agent asks for backup name if not provided with `/backup <name>`

**Files created:**

- `~/.openclaw/workspace/skills/backup/SKILL.md` — Skill metadata and documentation
- `~/.openclaw/workspace/skills/backup/scripts/backup.sh` — Bash script for backup execution

**Execution flow:**

```
User: /backup before-refactor
LLM: runs bash script
Script: creates ~/Desktop/openclaw-backups-before-refactor-2026-02-10-16-19-24.tar.gz (23.6MB)
LLM: reports path, size, what was backed up
```

**Verification:** ✅

- Script tested with and without name argument
- Archive verified to contain both `.openclaw/` and `openclaw-main/` directories
- Size: ~23.6MB for full backup
- JSON output returns path, size, timestamp, contents summary

**Impact:** Users have an easy `/backup` command to snapshot their entire OpenClaw setup for safe keeping before major changes.

---

## Session Outcomes

| Change                  | Files           | Tests                       | Status      |
| ----------------------- | --------------- | --------------------------- | ----------- |
| Cron attribution footer | 2 files         | 86/86 cron + announce tests | ✅ Complete |
| Cron payload validation | 2 files         | 71/71 cron tests            | ✅ Complete |
| `/backup` skill         | 2 files created | Manual verification         | ✅ Complete |

**Total changes:** 4 files modified, 2 files created

**Build verification:**

- `pnpm tsgo` — Zero TypeScript errors
- `pnpm build` — Clean build
- `npx vitest run src/cron/` — All 86 tests passing
- Gateway restarted successfully (PID 1536)

---

## Architecture Impact

### Cron Delivery Path

The cron isolated agent delivery path now mirrors the sub-agent announce flow:

**Before:**

```
Cron job runs → Agent output → Direct delivery to channel (NO attribution)
```

**After:**

```
Cron job runs → Agent output → Read tools from transcript → Append attribution footer → Deliver to channel
```

**Both paths (cron + sub-agent announce) now produce:**

```
[Agent output text]

**Processed by X Agent** using tool1, tool2
```

This ensures consistent UX across all autonomous agent execution modes.

### Cron Payload Handling

The gateway now correctly handles all cron payload variations:

```
User/Gemini payload → Normalize (fix agentId, kind, content fields) → Schema validation (with accountId) → Persist job
```

### Skills Architecture

New skill type: **workspace utility skills** that wrap shell operations

- Pattern: SKILL.md (metadata) + scripts/ (execution)
- Registration: `user-invocable: true` for slash command support
- Execution: LLM orchestrates interaction (prompts user, runs script, reports results)
- No direct user prompting in scripts (LLM handles that)

---

## Testing and Verification

**All changes verified:**

1. ✅ Cron attribution footer appends correctly to all agent types
2. ✅ Cron payload normalization fixes Gemini-generated payloads
3. ✅ Schema validation accepts all valid delivery configurations
4. ✅ Backup script creates valid tar.gz archives
5. ✅ Backup includes both required directories and excludes unnecessary files
6. ✅ Gateway restart successful; skills registered
7. ✅ All existing tests pass (86 cron tests, 38 announce tests)

---

## Documentation Updates Needed

- `docs/concepts/monitoring-retry-architecture.md` — Add cron delivery attribution section
- `docs/automation/cron-jobs.md` — Document agent binding and delivery behavior
- `docs/tools/skills.md` — Add backup skill as example
- `docs/tools/creating-skills.md` — Document workspace utility skill pattern
- `docs/concepts/system-architecture.md` — Update cron delivery flow diagram
