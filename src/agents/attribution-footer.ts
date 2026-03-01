import { resolveSessionTranscriptPath } from "../config/sessions/paths.js";
import { readSessionMessages } from "../gateway/session-utils.fs.js";
import { extractToolCallNames } from "../utils/transcript-tools.js";

/**
 * Extract all tool names used in a session by reading the transcript.
 * Best-effort: returns empty array if transcript cannot be read.
 *
 * @param params.sessionId - The session ID to read the transcript for
 * @param params.agentId - Optional agent ID for multi-agent setups
 * @param params.storePath - Optional path to the session store
 * @returns Array of tool names used in the session (sorted alphabetically)
 */
export function extractToolsFromSession(params: {
  sessionId: string;
  agentId?: string;
  storePath?: string;
}): string[] {
  try {
    const transcriptPath = resolveSessionTranscriptPath(params.sessionId, params.agentId);
    const messages = readSessionMessages(params.sessionId, params.storePath, transcriptPath);

    const toolsSet = new Set<string>();
    for (const message of messages) {
      if (message && typeof message === "object") {
        const toolNames = extractToolCallNames(message as Record<string, unknown>);
        toolNames.forEach((name) => toolsSet.add(name));
      }
    }

    return Array.from(toolsSet).sort();
  } catch {
    // Best-effort: skip attribution if transcript is unreadable
    return [];
  }
}

/**
 * Build attribution footer in the format:
 * "**Processed by Agent Name** using tool1, tool2"
 *
 * If no tools were used, returns just "**Processed by Agent Name**"
 *
 * @param params.agentName - The name of the agent (e.g., "Research Agent")
 * @param params.toolsUsed - Array of tool names used by the agent
 * @returns Formatted attribution footer string
 */
export function buildAttributionFooter(params: { agentName: string; toolsUsed: string[] }): string {
  const toolsSuffix = params.toolsUsed.length > 0 ? ` using ${params.toolsUsed.join(", ")}` : "";
  return `**Processed by ${params.agentName}**${toolsSuffix}`;
}
