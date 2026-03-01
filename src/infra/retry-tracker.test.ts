/**
 * Tests for the centralized retry state tracker.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createRetryTracker,
  getGlobalRetryTracker,
  registerRetryTrackerHandler,
  type RetryTrackerEvent,
} from "./retry-tracker.js";

describe("createRetryTracker", () => {
  it("records attempt and increments attempt count", () => {
    const tracker = createRetryTracker();
    tracker.recordAttempt("op1", "tool", "Connection timeout");

    const state = tracker.getState("op1");
    expect(state).toBeDefined();
    expect(state!.operationId).toBe("op1");
    expect(state!.kind).toBe("tool");
    expect(state!.attempt).toBe(1);
    expect(state!.maxAttempts).toBe(3);
    expect(state!.lastError).toBe("Connection timeout");
    expect(state!.settled).toBe(false);
  });

  it("increments attempt on second failure", () => {
    const tracker = createRetryTracker();
    tracker.recordAttempt("op1", "tool", "Error 1");
    tracker.recordAttempt("op1", "tool", "Error 2");

    const state = tracker.getState("op1");
    expect(state!.attempt).toBe(2);
    expect(state!.lastError).toBe("Error 2");
    expect(state!.settled).toBe(false);
  });

  it("marks exhausted when maxAttempts reached", () => {
    const tracker = createRetryTracker();
    tracker.recordAttempt("op1", "tool", "Error 1");
    tracker.recordAttempt("op1", "tool", "Error 2");
    tracker.recordAttempt("op1", "tool", "Error 3");

    const state = tracker.getState("op1");
    expect(state!.settled).toBe(true);
    expect(state!.outcome).toBe("exhausted");
    expect(tracker.isExhausted("op1")).toBe(true);
  });

  it("records success and marks settled", () => {
    const tracker = createRetryTracker();
    tracker.recordAttempt("op1", "tool", "Error 1");
    tracker.recordSuccess("op1");

    const state = tracker.getState("op1");
    expect(state!.settled).toBe(true);
    expect(state!.outcome).toBe("success");
    expect(tracker.isExhausted("op1")).toBe(false);
  });

  it("ignores new attempts after settled", () => {
    const tracker = createRetryTracker();
    tracker.recordAttempt("op1", "tool");
    tracker.recordSuccess("op1");
    tracker.recordAttempt("op1", "tool", "New error");

    const state = tracker.getState("op1");
    expect(state!.attempt).toBe(1);
    expect(state!.outcome).toBe("success");
  });

  it("emits event on recordAttempt", () => {
    const tracker = createRetryTracker();
    const events: RetryTrackerEvent[] = [];
    tracker.onEvent((e) => events.push(e));

    tracker.recordAttempt("op1", "tool", "Error");

    expect(events).toHaveLength(1);
    expect(events[0]!.phase).toBe("attempt");
    expect(events[0]!.state.attempt).toBe(1);
  });

  it("emits exhausted event when retries exhausted", () => {
    const tracker = createRetryTracker();
    const events: RetryTrackerEvent[] = [];
    tracker.onEvent((e) => events.push(e));

    tracker.recordAttempt("op1", "tool", "Error 1");
    tracker.recordAttempt("op1", "tool", "Error 2");
    tracker.recordAttempt("op1", "tool", "Error 3");

    const exhaustedEvents = events.filter((e) => e.phase === "exhausted");
    expect(exhaustedEvents).toHaveLength(1);
    expect(exhaustedEvents[0]!.state.settled).toBe(true);
  });

  it("emits success event on recordSuccess", () => {
    const tracker = createRetryTracker();
    const events: RetryTrackerEvent[] = [];
    tracker.onEvent((e) => events.push(e));

    tracker.recordAttempt("op1", "tool");
    tracker.recordSuccess("op1");

    const successEvents = events.filter((e) => e.phase === "success");
    expect(successEvents).toHaveLength(1);
    expect(successEvents[0]!.state.outcome).toBe("success");
  });

  it("supports multiple operations independently", () => {
    const tracker = createRetryTracker();

    tracker.recordAttempt("op1", "tool", "Error");
    tracker.recordAttempt("op2", "subagent", "Error");
    tracker.recordSuccess("op1");

    expect(tracker.getState("op1")!.outcome).toBe("success");
    expect(tracker.getState("op2")!.outcome).toBeUndefined();
  });

  it("clears state for operation", () => {
    const tracker = createRetryTracker();
    tracker.recordAttempt("op1", "tool");
    tracker.clearState("op1");

    expect(tracker.getState("op1")).toBeUndefined();
  });

  it("preserves firstAttemptAt timestamp", () => {
    const tracker = createRetryTracker();
    const before = Date.now();
    tracker.recordAttempt("op1", "tool");
    const after = Date.now();

    const state = tracker.getState("op1");
    expect(state!.firstAttemptAt).toBeGreaterThanOrEqual(before);
    expect(state!.firstAttemptAt).toBeLessThanOrEqual(after);
  });

  it("updates lastAttemptAt on each attempt", () => {
    vi.useFakeTimers();
    const tracker = createRetryTracker();

    tracker.recordAttempt("op1", "tool");
    const firstLast = tracker.getState("op1")!.lastAttemptAt;

    vi.advanceTimersByTime(100);
    tracker.recordAttempt("op1", "tool");
    const secondLast = tracker.getState("op1")!.lastAttemptAt;

    expect(secondLast).toBeGreaterThan(firstLast);
    vi.useRealTimers();
  });

  it("handles missing operation in recordSuccess gracefully", () => {
    const tracker = createRetryTracker();
    tracker.recordSuccess("nonexistent");

    const state = tracker.getState("nonexistent");
    expect(state).toBeDefined();
    expect(state!.outcome).toBe("success");
  });

  it("tracks different operation kinds", () => {
    const tracker = createRetryTracker();

    tracker.recordAttempt("op1", "tool");
    tracker.recordAttempt("op2", "subagent");
    tracker.recordAttempt("op3", "skill");
    tracker.recordAttempt("op4", "agent-turn");

    expect(tracker.getState("op1")!.kind).toBe("tool");
    expect(tracker.getState("op2")!.kind).toBe("subagent");
    expect(tracker.getState("op3")!.kind).toBe("skill");
    expect(tracker.getState("op4")!.kind).toBe("agent-turn");
  });

  it("emits exhausted on last maxAttempts attempt", () => {
    const tracker = createRetryTracker();
    const events: RetryTrackerEvent[] = [];
    tracker.onEvent((e) => events.push(e));

    tracker.recordAttempt("op1", "tool", "Error 1");
    tracker.recordAttempt("op1", "tool", "Error 2");
    tracker.recordAttempt("op1", "tool", "Error 3");

    // Should have 3 "attempt" events + 1 "exhausted" event
    expect(events.filter((e) => e.phase === "attempt")).toHaveLength(3);
    expect(events.filter((e) => e.phase === "exhausted")).toHaveLength(1);
  });
});

describe("getGlobalRetryTracker", () => {
  it("returns singleton instance", () => {
    const tracker1 = getGlobalRetryTracker();
    const tracker2 = getGlobalRetryTracker();
    expect(tracker1).toBe(tracker2);
  });

  it("registers pending handlers on initialization", () => {
    // Create a fresh global for this test
    const handler = vi.fn();
    registerRetryTrackerHandler(handler);

    const tracker = getGlobalRetryTracker();

    expect(handler).toHaveBeenCalledWith(tracker);
  });
});
