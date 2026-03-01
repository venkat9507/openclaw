# Implementation Plan: Snappify-Export Telegram Delivery

## Problem Statement

**Current State:**

- `snappify-export` skill executes Puppeteer automation to create images from snappify.com editor
- Skill outputs plain text: `"Output saved to /path/to/file"`
- Agent cannot parse the output or send the image to Telegram
- User must manually retrieve the file

**Desired State:**

- User invokes `/snappify-export <code>` via Telegram
- Agent executes skill and receives structured JSON response
- Agent automatically sends the generated image back to Telegram
- User receives the snappify image directly in the conversation

**User Value:**

- Seamless workflow: request → receive image in Telegram
- No manual file retrieval needed
- Works with existing OpenClaw messaging infrastructure

---

## Solution Architecture

### Discovery: OpenClaw Already Supports File URLs! ✅

**Key Finding:** OpenClaw's Telegram send function supports `file://` URLs for local files.

**Evidence:**

1. **File:** `src/web/media.ts` (Line ~190)

   ```javascript
   if (mediaUrl.startsWith("file://")) {
     mediaUrl = fileURLToPath(mediaUrl); // Converts file:// to local path
   }
   ```

2. **File:** `src/telegram/send.ts` (Line ~324-365)
   ```javascript
   if (mediaUrl) {
     const media = await loadWebMedia(mediaUrl, opts.maxBytes);
     // ...
     if (kind === "image") {
       result = await api.sendPhoto(chatId, file, mediaParams);
     }
   }
   ```

### Flow Diagram

```
User (Telegram)
    ↓
    "/snappify-export console.log('hello')"
    ↓
Main Agent
    ↓
    Executes snappify-export skill
    ↓
Skill (Puppeteer)
    ├─ Opens snappify.com editor
    ├─ Pastes code
    ├─ Exports/screenshots image
    └─ Returns JSON: {"success": true, "file_url": "file:///path/to/output.png"}
    ↓
Agent Parses JSON
    ↓
Agent Calls OpenClaw Messaging
    └─ sessions.send with mediaUrl: "file:///path/to/output.png"
    ↓
OpenClaw Gateway
    ├─ loadWebMedia(file:// URL)
    ├─ Converts to buffer
    └─ api.sendPhoto(chatId, buffer)
    ↓
User Receives Image (Telegram)
```

---

## Required Changes

### Phase 1: Skill Output Format (JSON)

#### File 1: `~/.openclaw/workspace/skills/snappify-export/scripts/snappify_automation.js`

**Location:** Line 115 (success case)

**Current Code:**

```javascript
console.log("Output saved to", outPath);
```

**New Code:**

```javascript
console.log(
  JSON.stringify({
    success: true,
    output_path: outPath,
    file_url: `file://${outPath}`,
    method: didExport ? "download" : "screenshot",
    message: "Snappify image created successfully",
  }),
);
```

**Location:** Line 117-118 (error case)

**Current Code:**

```javascript
} catch (err) {
  console.error('Error during automation:', err && err.message || err);
}
```

**New Code:**

```javascript
} catch (err) {
  console.log(JSON.stringify({
    success: false,
    error: err && err.message || String(err),
    message: 'Failed to create snappify image'
  }));
  process.exit(1);
}
```

**Rationale:**

- Structured JSON allows agent to parse response programmatically
- `file_url` provides ready-to-use file:// URL for OpenClaw
- Error handling ensures failures are also returned as JSON

---

### Phase 2: Skill Metadata (User-Invocable)

#### File 2: `~/.openclaw/workspace/skills/snappify-export/SKILL.md`

**Location:** Frontmatter (Lines 1-4)

**Current Code:**

```yaml
---
name: snappify-export
description: Create and export images from snappify.com editor using Puppeteer.
---
```

**New Code:**

```yaml
---
name: snappify-export
description: Create and export images from snappify.com editor using Puppeteer.
user-invocable: true
---
```

**Rationale:**

- `user-invocable: true` enables `/snappify-export` slash command
- Allows users to invoke skill directly from Telegram/CLI

---

### Phase 3: Agent Instructions (Delivery Behavior)

#### File 3: `~/.openclaw/workspace/skills/snappify-export/SKILL.md`

**Location:** After frontmatter, before current content

**Add New Section:**

````markdown
## Agent Behavior

When this skill is invoked:

1. **Execute the skill** with user-provided text/code as argument
   ```bash
   bash scripts/run.sh "<user-provided-code>"
   ```
````

2. **Parse the JSON response** from stdout:
   - Success case: `{"success": true, "file_url": "file://...", ...}`
   - Error case: `{"success": false, "error": "...", ...}`

3. **Send the image to Telegram** using the file URL:
   - Use `sessions.send` or messaging tool with `mediaUrl: <file_url>`
   - Include success message: "Here's your snappify image"

4. **Handle errors gracefully:**
   - If `success: false`, notify user with error message
   - If skill execution fails, report the failure to user

### Example Usage

**User Request (Telegram):**

```
/snappify-export console.log("Hello, World!");
```

**Agent Response:**

1. Executes: `bash scripts/run.sh "console.log(\"Hello, World!\");"`
2. Receives: `{"success": true, "file_url": "file:///path/to/output.png", ...}`
3. Sends image to Telegram with caption: "Here's your snappify image"

````

**Rationale:**
- Explicit instructions guide agent on how to handle skill output
- Ensures consistent behavior across different agent invocations
- Documents expected error handling

---

## Testing Plan

### Test 1: Skill JSON Output

**Command:**
```bash
cd ~/.openclaw/workspace/skills/snappify-export
bash scripts/run.sh "console.log('test')"
````

**Expected Output:**

```json
{
  "success": true,
  "output_path": "/full/path/to/snappify-output.png",
  "file_url": "file:///full/path/to/snappify-output.png",
  "method": "screenshot",
  "message": "Snappify image created successfully"
}
```

**Validation:**

- Output is valid JSON
- `file_url` starts with `file://`
- Image file exists at `output_path`

---

### Test 2: Skill Error Handling

**Command:**

```bash
cd ~/.openclaw/workspace/skills/snappify-export
# Simulate failure (no input)
bash scripts/run.sh ""
```

**Expected Output:**

```json
{
  "success": false,
  "error": "Usage: snappify_automation.js \"text to render\"",
  "message": "Failed to create snappify image"
}
```

**Validation:**

- Output is valid JSON
- `success: false`
- Error message is descriptive

---

### Test 3: Slash Command Registration

**Command:**

```bash
# After gateway restart
openclaw skills list | grep snappify
```

**Expected Output:**

```
snappify-export  Create and export images from snappify.com editor using Puppeteer.
```

**Validation:**

- Skill appears in skills list
- Can be invoked via `/snappify-export`

---

### Test 4: End-to-End Telegram Delivery

**Setup:**

1. Ensure gateway is running
2. Telegram bot is connected
3. Skills are loaded

**Test Steps:**

1. Send to Telegram bot: `/snappify-export console.log("Hello from Telegram!")`
2. Wait for agent to execute skill
3. Agent should parse JSON response
4. Agent should send image back to Telegram

**Expected Result:**

- User receives Telegram message with attached image
- Image shows snappify editor with the code
- Message includes success caption

**Validation:**

- Image received in Telegram
- Image content matches input code
- No error messages

---

### Test 5: File URL Loading

**Manual Test (if needed):**

```bash
# Create test image
echo "test" > /tmp/test-snappify.png

# Test OpenClaw's file:// URL handling
openclaw message send \
  --channel telegram \
  --media-url "file:///tmp/test-snappify.png" \
  "Test image delivery"
```

**Expected Result:**

- Image sends to Telegram successfully
- No errors in gateway logs

**Validation:**

- Verify `loadWebMedia` handles file:// URLs
- Verify Telegram receives the image

---

## Implementation Sequence

### Step 1: Modify Skill Output ✅

- Edit `snappify_automation.js` (Lines 115, 117-118)
- Add JSON output for success and error cases

### Step 2: Update Skill Metadata ✅

- Edit `SKILL.md` frontmatter
- Add `user-invocable: true`

### Step 3: Add Agent Instructions ✅

- Edit `SKILL.md` body
- Add "Agent Behavior" section with delivery instructions

### Step 4: Test Skill Locally ✅

- Run Test 1 (JSON output)
- Run Test 2 (error handling)
- Verify JSON structure

### Step 5: Restart Gateway ✅

- Stop gateway: `pkill -9 -f openclaw-gateway`
- Start gateway: `nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &`
- Verify skill loaded: `openclaw skills list`

### Step 6: Test Slash Command ✅

- Run Test 3 (skill registration)
- Verify `/snappify-export` is available

### Step 7: End-to-End Test ✅

- Run Test 4 (Telegram delivery)
- Verify complete workflow

### Step 8: Documentation Update ✅

- Update `run_local.md` with snappify-export usage
- Add examples to skill README

---

## Rollback Plan

If issues occur:

**Rollback Step 1: Revert Skill Changes**

```bash
cd ~/.openclaw/workspace/skills/snappify-export
git checkout scripts/snappify_automation.js SKILL.md
```

**Rollback Step 2: Restart Gateway**

```bash
pkill -9 -f openclaw-gateway
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

**Rollback Step 3: Verify**

```bash
tail -50 /tmp/openclaw-gateway.log
```

---

## Files Modified

| File                                                                          | Purpose          | Changes                                                                       |
| ----------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `~/.openclaw/workspace/skills/snappify-export/scripts/snappify_automation.js` | Skill automation | Lines 115, 117-118: Add JSON output                                           |
| `~/.openclaw/workspace/skills/snappify-export/SKILL.md`                       | Skill metadata   | Frontmatter: Add `user-invocable: true`<br>Body: Add "Agent Behavior" section |

---

## Success Criteria

✅ Skill returns valid JSON with `file_url` field
✅ Skill is user-invocable via `/snappify-export`
✅ Agent can parse skill output
✅ Agent sends image to Telegram using `file://` URL
✅ User receives snappify image directly in Telegram
✅ Error cases return structured JSON
✅ No manual file retrieval needed

---

## Risks and Mitigations

### Risk 1: Headful Browser Permissions

**Risk:** macOS may prompt for screen recording permissions when Puppeteer runs headful browser
**Mitigation:** Document permission requirements in SKILL.md README
**Impact:** Medium (first-run only)

### Risk 2: Large File Size

**Risk:** Generated images may exceed Telegram's file size limit (20MB for photos)
**Mitigation:** OpenClaw's `loadWebMedia` already optimizes images
**Impact:** Low (screenshots unlikely to exceed limit)

### Risk 3: Snappify UI Changes

**Risk:** Snappify's editor UI may change, breaking automation
**Mitigation:** Skill already has fallback to screenshot if export fails
**Impact:** Medium (requires skill update if UI changes)

### Risk 4: File Path Spaces/Special Chars

**Risk:** File paths with spaces may break file:// URL
**Mitigation:** `fileURLToPath` handles URL encoding
**Impact:** Low (already handled by OpenClaw)

---

## Dependencies

- Node.js 22+ (already installed)
- Puppeteer (auto-installed by skill on first run)
- OpenClaw gateway running
- Telegram bot configured
- Display server (for headful browser)

---

## Future Enhancements

1. **Configurable Output Location:**
   - Add skill parameter: `--output-dir <path>`
   - Default to `~/.openclaw/workspace/tmp/snappify/`

2. **Custom Snappify Themes:**
   - Add skill parameter: `--theme <name>`
   - Support different code themes

3. **Multi-Format Export:**
   - Support SVG, PDF, PNG formats
   - Add parameter: `--format <svg|pdf|png>`

4. **Batch Processing:**
   - Accept multiple code snippets
   - Generate multiple images in one invocation

5. **Cleanup Old Files:**
   - Auto-delete snappify outputs older than 7 days
   - Add to skill's cron job or cleanup task

---

## Questions for Review

1. Should we save output to a fixed directory (`~/.openclaw/workspace/tmp/`) instead of `process.cwd()`?
2. Should we add a cleanup mechanism for old snappify images?
3. Should we support headless mode as an option (with disclaimer about potential UI issues)?
4. Should we add file size validation before sending to Telegram?

---

**Last Updated:** 2026-02-13
**Status:** Ready for Implementation
**Estimated Time:** 30 minutes
