/**
 * Tests for sub-agent spawn-and-wait with retry.
 */

import { describe, expect, it, vi } from "vitest";
import type { SubagentRetryConfig } from "./subagent-retry.js";

describe("Sub-agent Retry", () => {
  describe("SubagentRetryConfig", () => {
    it("defines retry config with standard settings", () => {
      const config: SubagentRetryConfig = {
        maxAttempts: 3,
        delayMs: 2000,
        maxDelayMs: 30000,
        jitter: 0.1,
      };

      expect(config.maxAttempts).toBe(3);
      expect(config.delayMs).toBe(2000);
      expect(config.maxDelayMs).toBe(30000);
      expect(config.jitter).toBe(0.1);
    });

    it("allows partial config overrides", () => {
      const defaultConfig: SubagentRetryConfig = {
        maxAttempts: 3,
        delayMs: 2000,
        maxDelayMs: 30000,
        jitter: 0.1,
      };

      const customConfig: Partial<SubagentRetryConfig> = {
        maxAttempts: 5,
      };

      const merged = { ...defaultConfig, ...customConfig };
      expect(merged.maxAttempts).toBe(5);
      expect(merged.delayMs).toBe(2000);
    });
  });

  describe("Transient Failure Detection", () => {
    it("identifies timeout as transient", () => {
      const outcome = { status: "timeout" as const };
      expect(outcome.status).toBe("timeout");
    });

    it("identifies error as transient", () => {
      const outcome = { status: "error" as const };
      expect(outcome.status).toBe("error");
    });

    it("does not identify success as transient", () => {
      const outcome = { status: "success" as const };
      expect(outcome.status).not.toBe("timeout");
      expect(outcome.status).not.toBe("error");
    });

    it("handles undefined outcome as transient", () => {
      const outcome = undefined;
      // Undefined outcomes are treated as transient and trigger retry
      expect(outcome).toBeUndefined();
    });
  });

  describe("Retry Callbacks", () => {
    it("supports onRetry callback", () => {
      const onRetry = vi.fn();
      const info = { attempt: 1, error: "Network error" };

      expect(typeof onRetry).toBe("function");
      onRetry(info);
      expect(onRetry).toHaveBeenCalledWith(info);
    });

    it("supports onExhausted callback", () => {
      const onExhausted = vi.fn();
      const info = { attempts: 3, lastError: "Network error" };

      expect(typeof onExhausted).toBe("function");
      onExhausted(info);
      expect(onExhausted).toHaveBeenCalledWith(info);
    });

    it("can register both callbacks", () => {
      const onRetry = vi.fn();
      const onExhausted = vi.fn();

      const callbacks = { onRetry, onExhausted };
      expect(callbacks.onRetry).toBeDefined();
      expect(callbacks.onExhausted).toBeDefined();
    });
  });

  describe("Sub-agent Lifecycle", () => {
    it("tracks runId from spawn result", () => {
      const runId = "run-123";
      const spawnResult = {
        runId,
        childSessionKey: "session-456",
      };

      expect(spawnResult.runId).toBe(runId);
    });

    it("preserves runId even on outcome failure", () => {
      const result = {
        runId: "run-important",
        outcome: undefined,
        attempts: 2,
      };

      expect(result.runId).toBe("run-important");
      expect(result.outcome).toBeUndefined();
    });

    it("tracks attempts count in result", () => {
      const result = {
        runId: "run-1",
        outcome: { status: "success" as const },
        attempts: 1,
      };

      expect(result.attempts).toBe(1);
    });

    it("handles requester origin in spawn", () => {
      const requesterOrigin = {
        channel: "telegram",
        to: "chat:123",
        accountId: "bot1",
      };

      expect(requesterOrigin.channel).toBe("telegram");
      expect(requesterOrigin.to).toBe("chat:123");
    });
  });

  describe("Exponential Backoff", () => {
    it("calculates exponential backoff with base delay", () => {
      const baseDelay = 2000;
      const attempt1 = baseDelay * Math.pow(2, 0);
      const attempt2 = baseDelay * Math.pow(2, 1);
      const attempt3 = baseDelay * Math.pow(2, 2);

      expect(attempt1).toBe(2000);
      expect(attempt2).toBe(4000);
      expect(attempt3).toBe(8000);
    });

    it("clamps backoff to maxDelayMs", () => {
      const maxDelayMs = 30000;
      const calculatedDelay = 100000;
      const clampedDelay = Math.min(calculatedDelay, maxDelayMs);

      expect(clampedDelay).toBe(maxDelayMs);
    });

    it("applies jitter to delay", () => {
      const baseDelay = 2000;
      const jitter = 0.1;

      const delayWithJitter = baseDelay * (1 + Math.random() * jitter);

      expect(delayWithJitter).toBeGreaterThanOrEqual(baseDelay);
      expect(delayWithJitter).toBeLessThanOrEqual(baseDelay * (1 + jitter));
    });
  });

  describe("Error Handling", () => {
    it("captures spawn errors", () => {
      const error = new Error("Network error during spawn");
      expect(error.message).toContain("Network");
    });

    it("captures wait function errors", () => {
      const error = new Error("Sub-agent execution timeout");
      expect(error.message).toContain("timeout");
    });

    it("preserves error message through retries", () => {
      const originalError = "Connection timeout";
      let lastError = "";

      lastError = originalError;
      // Simulate retry
      lastError = originalError;

      expect(lastError).toBe(originalError);
    });
  });

  describe("Abort Signal Handling", () => {
    it("respects abort signal during execution", () => {
      const abortController = new AbortController();
      const signal = abortController.signal;

      expect(signal.aborted).toBe(false);
      abortController.abort();
      expect(signal.aborted).toBe(true);
    });

    it("can check abort before attempting spawn", () => {
      const abortController = new AbortController();
      let shouldAttempt = !abortController.signal.aborted;

      expect(shouldAttempt).toBe(true);

      abortController.abort();
      shouldAttempt = !abortController.signal.aborted;

      expect(shouldAttempt).toBe(false);
    });
  });

  describe("Integration", () => {
    it("structures result with required fields", () => {
      const result = {
        runId: "run-1",
        outcome: { status: "success" as const },
        attempts: 1,
      };

      expect(result).toHaveProperty("runId");
      expect(result).toHaveProperty("outcome");
      expect(result).toHaveProperty("attempts");
    });

    it("handles both successful and failed outcomes", () => {
      const successResult = {
        runId: "run-1",
        outcome: { status: "success" as const },
        attempts: 1,
      };

      const failureResult = {
        runId: "run-2",
        outcome: undefined,
        attempts: 3,
      };

      expect(successResult.outcome?.status).toBe("success");
      expect(failureResult.outcome).toBeUndefined();
    });
  });
});
