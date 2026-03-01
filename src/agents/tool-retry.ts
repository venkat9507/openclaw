/**
 * Tool-level retry wrapper for network-dependent tools.
 * Follows the wrapToolWithAbortSignal pattern from pi-tools.abort.ts.
 * Only retries transient errors (timeouts, 5xx, rate limits).
 */

import { getGlobalRetryTracker, type RetryableOperationKind } from "../infra/retry-tracker.js";
import { retryAsync } from "../infra/retry.js";
import type { AnyAgentTool } from "./tools/common.js";

export type ToolRetryConfig = {
  maxAttempts: number;
  minDelayMs: number;
  maxDelayMs: number;
  jitter?: number; // 0-1, amount of jitter to apply
  shouldRetry?: (error: unknown) => boolean;
};

export type ToolRetryCallbacks = {
  onRetry?: (info: { toolName: string; attempt: number; error: string }) => void;
  onExhausted?: (info: { toolName: string; attempts: number; lastError: string }) => void;
};

const DEFAULT_TOOL_RETRY_CONFIG: ToolRetryConfig = {
  maxAttempts: 3,
  minDelayMs: 300,
  maxDelayMs: 10000,
  jitter: 0.1, // 10% jitter
};

/**
 * Check if an error is transient and should be retried.
 * Only retries: timeouts, 5xx errors, rate limits, connection errors.
 * Never retries: validation, auth, abort, 4xx (except 429).
 */
function isTransientError(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;

  // Timeout errors
  if (typeof err.code === "string") {
    if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
      return true;
    }
  }

  // HTTP status codes
  if (typeof err.status === "number") {
    const status = err.status;
    // 5xx errors: server errors
    if (status >= 500 && status < 600) return true;
    // 429: Too Many Requests (rate limit)
    if (status === 429) return true;
    // 408: Request Timeout
    if (status === 408) return true;
    // 4xx but NOT transient (except 429 above)
    if (status >= 400 && status < 500) return false;
  }

  // Network/timeout error messages
  const message = String(err.message || "").toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("network") ||
    message.includes("429") ||
    message.includes("rate limit")
  ) {
    return true;
  }

  return false;
}

/**
 * Wrap a tool with retry logic.
 * Follows the wrapToolWithAbortSignal pattern for composition.
 */
export function wrapToolWithRetry(
  tool: AnyAgentTool,
  config?: Partial<ToolRetryConfig>,
  callbacks?: ToolRetryCallbacks,
): AnyAgentTool {
  const finalConfig: ToolRetryConfig = {
    ...DEFAULT_TOOL_RETRY_CONFIG,
    ...config,
  };

  const shouldRetry = config?.shouldRetry ?? isTransientError;
  const tracker = getGlobalRetryTracker();
  const operationId = `tool:${tool.name}:${Date.now()}:${Math.random()}`;

  return {
    ...tool,
    label: tool.label ? `${tool.label} (with retry)` : tool.label,
    execute: async (toolCallId: string, args: Record<string, unknown>, signal?: AbortSignal) => {
      let lastError: Error | undefined;

      const executeWithRetry = async () => {
        try {
          return await tool.execute(toolCallId, args, signal);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          if (!shouldRetry(error)) {
            throw error;
          }

          throw error;
        }
      };

      try {
        const result = await retryAsync(executeWithRetry, {
          attempts: finalConfig.maxAttempts,
          minDelayMs: finalConfig.minDelayMs,
          maxDelayMs: finalConfig.maxDelayMs,
          jitter: finalConfig.jitter,
          shouldRetry,
        });

        tracker.recordSuccess(operationId);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        tracker.recordAttempt(operationId, "tool" as RetryableOperationKind, errorMsg);

        if (callbacks?.onExhausted && lastError) {
          callbacks.onExhausted({
            toolName: tool.name,
            attempts: finalConfig.maxAttempts,
            lastError: lastError.message,
          });
        }

        throw error;
      }
    },
  };
}

/**
 * Compose retry wrapper with abort signal wrapper.
 * Call this to apply both wrappers in the correct order.
 */
export function composeToolRetryAndAbort(
  tool: AnyAgentTool,
  retryConfig?: Partial<ToolRetryConfig>,
  retryCallbacks?: ToolRetryCallbacks,
): AnyAgentTool {
  // Apply retry first, then abort signal wrapping
  const withRetry = wrapToolWithRetry(tool, retryConfig, retryCallbacks);
  // Note: The abort signal wrapper is applied elsewhere in tool assembly
  return withRetry;
}
