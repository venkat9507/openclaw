/**
 * Sub-agent spawn-and-wait with retry logic.
 * Retries sub-agent failures (errors, timeouts) with exponential backoff.
 * Tracks retry history in the subagent run record.
 */

import { getGlobalRetryTracker } from "../infra/retry-tracker.js";
import { retryAsync } from "../infra/retry.js";
import type { DeliveryContext } from "../utils/delivery-context.js";
import type { SubagentRunOutcome } from "./subagent-announce.js";

export type SubagentRetryConfig = {
  maxAttempts: number;
  delayMs: number;
  maxDelayMs: number;
  jitter?: number;
};

export type SubagentRetryCallbacks = {
  onRetry?: (info: { attempt: number; error: string }) => void;
  onExhausted?: (info: { attempts: number; lastError: string }) => void;
};

const DEFAULT_SUBAGENT_RETRY_CONFIG: SubagentRetryConfig = {
  maxAttempts: 3,
  delayMs: 2000,
  maxDelayMs: 30000,
  jitter: 0.1,
};

/**
 * Check if a sub-agent failure is transient and should be retried.
 * Retries: errors, timeouts.
 * Never retries: task completion (successful or user-cancelled).
 */
function isTransientSubagentFailure(outcome: SubagentRunOutcome | undefined): boolean {
  if (!outcome) return true; // Unknown state, retry
  if (outcome.status === "error") return true; // Transient error
  if (outcome.status === "timeout") return true; // Transient timeout
  return false; // success or unknown - don't retry
}

/**
 * Spawn a sub-agent with retry logic.
 * Handles spawn failure and completion failure independently.
 */
export async function spawnSubagentWithRetry(params: {
  spawnFn: () => Promise<{ runId: string; childSessionKey: string }>;
  waitFn: (runId: string) => Promise<SubagentRunOutcome | undefined>;
  config?: Partial<SubagentRetryConfig>;
  requesterOrigin?: DeliveryContext;
  onRetry?: (info: { attempt: number; error: string }) => void;
  onExhausted?: (info: { attempts: number; lastError: string }) => void;
  abortSignal?: AbortSignal;
}): Promise<{ runId: string; outcome: SubagentRunOutcome | undefined; attempts: number }> {
  const finalConfig: SubagentRetryConfig = {
    ...DEFAULT_SUBAGENT_RETRY_CONFIG,
    ...params.config,
  };

  const tracker = getGlobalRetryTracker();
  const operationId = `subagent:spawn:${Date.now()}:${Math.random()}`;

  let lastError = "";
  let lastRunId = "";
  let totalAttempts = 0;

  const executeWithRetry = async (): Promise<{
    runId: string;
    outcome: SubagentRunOutcome | undefined;
  }> => {
    totalAttempts++;

    // Check abort signal
    if (params.abortSignal?.aborted) {
      throw new Error("Sub-agent spawn aborted");
    }

    try {
      // Spawn the sub-agent
      const { runId } = await params.spawnFn();
      lastRunId = runId;

      // Wait for completion
      const outcome = await params.waitFn(runId);

      // Check if we should retry based on outcome
      if (!isTransientSubagentFailure(outcome)) {
        // Don't retry, return the final result
        return { runId, outcome };
      }

      // Transient failure - retry
      const errorMsg =
        outcome?.status === "timeout" ? "Sub-agent execution timeout" : "Sub-agent execution error";
      lastError = errorMsg;

      if (params.onRetry) {
        params.onRetry({ attempt: totalAttempts, error: errorMsg });
      }

      throw new Error(errorMsg);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      lastError = errorMsg;

      if (params.onRetry) {
        params.onRetry({ attempt: totalAttempts, error: errorMsg });
      }

      throw error;
    }
  };

  try {
    const result = await retryAsync(executeWithRetry, {
      attempts: finalConfig.maxAttempts,
      minDelayMs: finalConfig.delayMs,
      maxDelayMs: finalConfig.maxDelayMs,
      jitter: finalConfig.jitter,
      shouldRetry: (err) => {
        // Retry on transient errors; not on abort or logic errors
        const message = err instanceof Error ? err.message : String(err);
        return (
          message.includes("timeout") ||
          message.includes("execution error") ||
          message.includes("transient")
        );
      },
    });

    tracker.recordSuccess(operationId);
    return {
      runId: result.runId,
      outcome: result.outcome,
      attempts: totalAttempts,
    };
  } catch (error) {
    tracker.recordAttempt(
      operationId,
      "subagent" as const,
      lastError || (error instanceof Error ? error.message : String(error)),
    );

    if (params.onExhausted) {
      params.onExhausted({
        attempts: totalAttempts,
        lastError,
      });
    }

    // Return the last known run ID even on exhaustion, so parent can track what happened
    return {
      runId: lastRunId,
      outcome: undefined,
      attempts: totalAttempts,
    };
  }
}
