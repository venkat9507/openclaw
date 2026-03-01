/**
 * Tests for failure notification system.
 */

import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { DeliveryContext } from "../utils/delivery-context.js";
import {
  sendFailureNotification,
  createFailureNotificationHandler,
  type FailureNotificationParams,
} from "./failure-notification.js";

// Mock the gateway
vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn().mockResolvedValue({ ok: true }),
}));

import { callGateway } from "../gateway/call.js";

describe("sendFailureNotification", () => {
  const mockDeliveryContext: DeliveryContext = {
    channel: "telegram",
    to: "chat:123",
    accountId: "bot1",
  };

  it("sends notification via gateway", async () => {
    (callGateway as any).mockClear();
    const params: FailureNotificationParams = {
      kind: "tool",
      operationLabel: "web_search",
      attempts: 3,
      lastError: "Connection timeout",
      deliveryContext: mockDeliveryContext,
    };

    const result = await sendFailureNotification(params);

    expect(result).toBe(true);
    expect(callGateway).toHaveBeenCalled();
  });

  it("includes operation label in notification", async () => {
    (callGateway as any).mockClear();
    const params: FailureNotificationParams = {
      kind: "tool",
      operationLabel: "web_search",
      attempts: 3,
      lastError: "Connection timeout",
      deliveryContext: mockDeliveryContext,
    };

    await sendFailureNotification(params);

    const callArgs = (callGateway as any).mock.calls[0]?.[0];
    const message = callArgs?.params?.message;
    expect(message).toContain("web_search");
  });

  it("returns false when deliveryContext is missing", async () => {
    (callGateway as any).mockClear();
    const params: FailureNotificationParams = {
      kind: "tool",
      operationLabel: "test",
      attempts: 3,
      lastError: "Error",
    };

    const result = await sendFailureNotification(params);

    expect(result).toBe(false);
  });

  it("returns false when gateway call fails", async () => {
    (callGateway as any).mockRejectedValueOnce(new Error("Gateway error"));
    const params: FailureNotificationParams = {
      kind: "tool",
      operationLabel: "test",
      attempts: 3,
      lastError: "Error",
      deliveryContext: mockDeliveryContext,
    };

    const result = await sendFailureNotification(params);

    expect(result).toBe(false);
    (callGateway as any).mockResolvedValue({ ok: true }); // reset
  });

  it("routes to correct channel", async () => {
    (callGateway as any).mockClear();
    const params: FailureNotificationParams = {
      kind: "tool",
      operationLabel: "test",
      attempts: 3,
      lastError: "Error",
      deliveryContext: mockDeliveryContext,
    };

    await sendFailureNotification(params);

    const callArgs = (callGateway as any).mock.calls[0]?.[0];
    expect(callArgs?.params?.channel).toBe("telegram");
    expect(callArgs?.params?.to).toBe("chat:123");
    expect(callArgs?.params?.accountId).toBe("bot1");
  });
});

describe("createFailureNotificationHandler", () => {
  const mockConfig: OpenClawConfig = {
    agents: {
      defaults: {
        retry: {
          notifications: {
            enabled: true,
            cooldownMs: 300000,
          },
        },
      },
    },
  } as any;

  const mockDeliveryContext: DeliveryContext = {
    channel: "telegram",
    to: "chat:123",
    accountId: "bot1",
  };

  it("creates a handler function", () => {
    const handler = createFailureNotificationHandler({
      cfg: mockConfig,
      defaultDeliveryContext: mockDeliveryContext,
    });

    expect(typeof handler).toBe("function");
  });

  it("ignores non-exhausted events", async () => {
    (callGateway as any).mockClear();
    const handler = createFailureNotificationHandler({
      cfg: mockConfig,
      defaultDeliveryContext: mockDeliveryContext,
    });

    await handler({
      phase: "attempt",
      state: {
        operationId: "op1",
        kind: "tool",
        attempt: 1,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        settled: false,
      },
    });

    expect(callGateway).not.toHaveBeenCalled();
  });

  it("sends notification on exhausted phase", async () => {
    (callGateway as any).mockClear();
    const handler = createFailureNotificationHandler({
      cfg: mockConfig,
      defaultDeliveryContext: mockDeliveryContext,
    });

    await handler({
      phase: "exhausted",
      state: {
        operationId: "test_tool",
        kind: "tool",
        attempt: 3,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastError: "Connection timeout",
        settled: true,
        outcome: "exhausted",
      },
    });

    expect(callGateway).toHaveBeenCalled();
  });

  it("respects cooldown between notifications", async () => {
    vi.useFakeTimers();
    (callGateway as any).mockClear();

    const handler = createFailureNotificationHandler({
      cfg: {
        agents: {
          defaults: {
            retry: {
              notifications: {
                enabled: true,
                cooldownMs: 10000, // 10 seconds for testing
              },
            },
          },
        },
      } as any,
      defaultDeliveryContext: mockDeliveryContext,
    });

    // First notification should be sent
    await handler({
      phase: "exhausted",
      state: {
        operationId: "op1",
        kind: "tool",
        attempt: 3,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastError: "Error 1",
        settled: true,
        outcome: "exhausted",
      },
    });

    expect(callGateway).toHaveBeenCalledTimes(1);

    // Advance time by 5 seconds (still in cooldown)
    vi.advanceTimersByTime(5000);

    // Second notification for same kind should be skipped
    await handler({
      phase: "exhausted",
      state: {
        operationId: "op2",
        kind: "tool",
        attempt: 3,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastError: "Error 2",
        settled: true,
        outcome: "exhausted",
      },
    });

    expect(callGateway).toHaveBeenCalledTimes(1); // Still only 1

    // Advance time by 6 more seconds (now past cooldown)
    vi.advanceTimersByTime(6000);

    // Third notification should be sent
    await handler({
      phase: "exhausted",
      state: {
        operationId: "op3",
        kind: "tool",
        attempt: 3,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastError: "Error 3",
        settled: true,
        outcome: "exhausted",
      },
    });

    expect(callGateway).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("tracks cooldown per operation kind", async () => {
    vi.useFakeTimers();
    (callGateway as any).mockClear();

    const handler = createFailureNotificationHandler({
      cfg: {
        agents: {
          defaults: {
            retry: {
              notifications: {
                enabled: true,
                cooldownMs: 10000,
              },
            },
          },
        },
      } as any,
      defaultDeliveryContext: mockDeliveryContext,
    });

    // Send tool notification
    await handler({
      phase: "exhausted",
      state: {
        operationId: "op1",
        kind: "tool",
        attempt: 3,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastError: "Error",
        settled: true,
        outcome: "exhausted",
      },
    });

    expect(callGateway).toHaveBeenCalledTimes(1);

    // Send subagent notification immediately (different kind)
    await handler({
      phase: "exhausted",
      state: {
        operationId: "op2",
        kind: "subagent",
        attempt: 3,
        maxAttempts: 3,
        firstAttemptAt: Date.now(),
        lastAttemptAt: Date.now(),
        lastError: "Error",
        settled: true,
        outcome: "exhausted",
      },
    });

    // Should be sent because it's a different kind
    expect(callGateway).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
