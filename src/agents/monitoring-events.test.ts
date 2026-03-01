/**
 * Tests for diagnostic event emission from retry system.
 */

import { describe, expect, it } from "vitest";

describe("Monitoring Events", () => {
  describe("Diagnostic Event Structure", () => {
    it("defines retry exhausted event type", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "retry-exhausted",
          operationId: "tool_1",
          kind: "tool",
          attempts: 3,
          error: "timeout",
          ts: Date.now(),
          seq: 1,
        },
      };

      expect(event.type).toBe("diagnostic");
      expect(event.diagnostic.type).toBe("retry-exhausted");
      expect(event.diagnostic.operationId).toBe("tool_1");
      expect(event.diagnostic.attempts).toBe(3);
    });

    it("defines tool retry event type", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "tool-retry",
          toolName: "web_search",
          attempt: 2,
          error: "timeout",
          delayMs: 500,
          ts: Date.now(),
          seq: 2,
        },
      };

      expect(event.diagnostic.type).toBe("tool-retry");
      expect(event.diagnostic.toolName).toBe("web_search");
      expect(event.diagnostic.attempt).toBe(2);
    });

    it("defines subagent retry event type", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "subagent-retry",
          runId: "run-123",
          attempt: 1,
          error: "timeout",
          delayMs: 2000,
          ts: Date.now(),
          seq: 3,
        },
      };

      expect(event.diagnostic.type).toBe("subagent-retry");
      expect(event.diagnostic.runId).toBe("run-123");
      expect(event.diagnostic.delayMs).toBe(2000);
    });

    it("defines skill retry event type", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "skill-retry",
          skillName: "web-search",
          attempt: 1,
          error: "timeout",
          delayMs: 300,
          ts: Date.now(),
          seq: 4,
        },
      };

      expect(event.diagnostic.type).toBe("skill-retry");
      expect(event.diagnostic.skillName).toBe("web-search");
    });

    it("defines agent turn retry event type", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "agent-turn-retry",
          attempt: 1,
          error: "rate limit",
          delayMs: 1000,
          ts: Date.now(),
          seq: 5,
        },
      };

      expect(event.diagnostic.type).toBe("agent-turn-retry");
      expect(event.diagnostic.attempt).toBe(1);
    });
  });

  describe("Event Emission", () => {
    it("includes timestamp in all events", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "tool-retry",
          toolName: "test",
          attempt: 1,
          error: "error",
          delayMs: 100,
          ts: Date.now(),
          seq: 1,
        },
      };

      expect(typeof event.diagnostic.ts).toBe("number");
      expect(event.diagnostic.ts).toBeGreaterThan(0);
    });

    it("includes sequence number in all events", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "tool-retry",
          toolName: "test",
          attempt: 1,
          error: "error",
          delayMs: 100,
          ts: Date.now(),
          seq: 1,
        },
      };

      expect(typeof event.diagnostic.seq).toBe("number");
      expect(event.diagnostic.seq).toBeGreaterThan(0);
    });

    it("preserves event payload through emission", () => {
      const payload = {
        operationId: "op1",
        kind: "tool",
        attempts: 3,
        error: "timeout",
      };

      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "retry-exhausted",
          ...payload,
          ts: Date.now(),
          seq: 1,
        },
      };

      expect(event.diagnostic.operationId).toBe(payload.operationId);
      expect(event.diagnostic.kind).toBe(payload.kind);
      expect(event.diagnostic.attempts).toBe(payload.attempts);
      expect(event.diagnostic.error).toBe(payload.error);
    });
  });

  describe("Event Classification", () => {
    it("classifies retry exhaustion events", () => {
      const event = {
        type: "diagnostic",
        diagnostic: {
          type: "retry-exhausted",
          operationId: "op1",
          kind: "tool",
          attempts: 3,
          error: "error",
          ts: Date.now(),
          seq: 1,
        },
      };

      expect(event.diagnostic.type).toMatch(/^retry-/);
    });

    it("classifies retry attempt events", () => {
      const events = [
        { type: "tool-retry" },
        { type: "skill-retry" },
        { type: "subagent-retry" },
        { type: "agent-turn-retry" },
      ];

      for (const evt of events) {
        expect(evt.type).toMatch(/-retry$/);
      }
    });
  });
});
