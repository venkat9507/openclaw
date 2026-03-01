/**
 * Centralized retry state tracking for all operations (tools, sub-agents, skills, agent turns).
 * Provides pub-sub event emission for retry events to enable monitoring, diagnostics, and notifications.
 */

export type RetryableOperationKind = "subagent" | "tool" | "skill" | "agent-turn";

export type RetryState = {
  operationId: string;
  kind: RetryableOperationKind;
  attempt: number;
  maxAttempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lastError?: string;
  settled: boolean;
  outcome?: "success" | "exhausted";
  /** Optional delivery context for routing failure notifications to the right channel. */
  deliveryContext?: unknown;
};

export type RetryTrackerEvent = {
  state: RetryState;
  phase: "attempt" | "success" | "exhausted";
};

export interface RetryTracker {
  /** Record a new retry attempt with optional error information and delivery context. */
  recordAttempt(
    operationId: string,
    kind: RetryableOperationKind,
    error?: string,
    deliveryContext?: unknown,
  ): void;

  /** Record successful completion of the operation. */
  recordSuccess(operationId: string): void;

  /** Check if an operation has exhausted its retry attempts. */
  isExhausted(operationId: string): boolean;

  /** Get the current state of a tracked operation. */
  getState(operationId: string): RetryState | undefined;

  /** Subscribe to retry events. */
  onEvent(callback: (event: RetryTrackerEvent) => void): void;

  /** Clear tracking for a completed operation. */
  clearState(operationId: string): void;
}

export function createRetryTracker(): RetryTracker {
  const states = new Map<string, RetryState>();
  const subscribers: Array<(event: RetryTrackerEvent) => void> = [];

  function emitEvent(state: RetryState, phase: RetryTrackerEvent["phase"]) {
    const event: RetryTrackerEvent = { state, phase };
    for (const subscriber of subscribers) {
      try {
        subscriber(event);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  return {
    recordAttempt(
      operationId: string,
      kind: RetryableOperationKind,
      error?: string,
      deliveryContext?: unknown,
    ): void {
      const existing = states.get(operationId);

      if (existing?.settled) {
        // Already settled, ignore new attempts
        return;
      }

      const now = Date.now();
      const maxAttempts = existing?.maxAttempts ?? 3;
      const newAttempt = existing ? existing.attempt + 1 : 1;
      const isExhausted = newAttempt >= maxAttempts;

      const updated: RetryState = {
        operationId,
        kind,
        attempt: newAttempt,
        maxAttempts,
        firstAttemptAt: existing?.firstAttemptAt ?? now,
        lastAttemptAt: now,
        lastError: error,
        settled: isExhausted,
        outcome: isExhausted ? ("exhausted" as const) : undefined,
        deliveryContext: deliveryContext ?? existing?.deliveryContext,
      };

      states.set(operationId, updated);
      emitEvent(updated, "attempt");

      // Emit exhausted event if just exhausted
      if (isExhausted) {
        emitEvent(updated, "exhausted");
      }
    },

    recordSuccess(operationId: string): void {
      const existing = states.get(operationId);
      if (!existing) {
        // Create a success state if it doesn't exist (shouldn't happen in normal flow)
        const now = Date.now();
        const state: RetryState = {
          operationId,
          kind: "tool",
          attempt: 1,
          maxAttempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
          settled: true,
          outcome: "success",
        };
        states.set(operationId, state);
        emitEvent(state, "success");
        return;
      }

      if (existing.settled) {
        return;
      }

      const updated: RetryState = {
        operationId: existing.operationId,
        kind: existing.kind,
        attempt: existing.attempt,
        maxAttempts: existing.maxAttempts,
        firstAttemptAt: existing.firstAttemptAt,
        lastAttemptAt: existing.lastAttemptAt,
        lastError: existing.lastError,
        settled: true,
        outcome: "success",
      };

      states.set(operationId, updated);
      emitEvent(updated, "success");
    },

    isExhausted(operationId: string): boolean {
      const state = states.get(operationId);
      return state !== undefined && state.settled && state.outcome === "exhausted";
    },

    getState(operationId: string): RetryState | undefined {
      return states.get(operationId);
    },

    onEvent(callback: (event: RetryTrackerEvent) => void): void {
      subscribers.push(callback);
    },

    clearState(operationId: string): void {
      states.delete(operationId);
    },
  };
}

// Global singleton instance
let globalTracker: RetryTracker | null = null;

// List of handlers to register when the tracker is initialized
const pendingHandlers: Array<(tracker: RetryTracker) => void> = [];
let handlersRegistered = false;

/**
 * Register a handler to be called when the global retry tracker is initialized.
 * If the tracker already exists, the handler is immediately registered.
 */
export function registerRetryTrackerHandler(handler: (tracker: RetryTracker) => void): void {
  if (globalTracker) {
    // Tracker already exists, register immediately
    handler(globalTracker);
  } else {
    // Tracker not yet created, add to pending handlers
    pendingHandlers.push(handler);
  }
}

export function getGlobalRetryTracker(): RetryTracker {
  if (!globalTracker) {
    globalTracker = createRetryTracker();

    // Register all pending handlers
    if (!handlersRegistered) {
      handlersRegistered = true;
      for (const handler of pendingHandlers) {
        try {
          handler(globalTracker);
        } catch (error) {
          // Log handler errors but don't break tracker initialization
          console.warn(
            `Failed to register retry tracker handler: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
  return globalTracker;
}
