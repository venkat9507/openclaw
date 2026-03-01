/**
 * Diagnostic event types for monitoring, retry, and observability.
 * These events feed into the OpenTelemetry pipeline via extensions/diagnostics-otel.
 */

import type { RetryableOperationKind } from "../infra/retry-tracker.js";

type DiagnosticBaseEvent = {
  ts: number;
  seq: number;
};

export type DiagnosticRetryExhaustedEvent = DiagnosticBaseEvent & {
  type: "retry.exhausted";
  operationId: string;
  kind: RetryableOperationKind;
  attempts: number;
  lastError: string;
  duration: number; // milliseconds from first attempt
};

export type DiagnosticToolRetryEvent = DiagnosticBaseEvent & {
  type: "tool.retry";
  toolName: string;
  attempt: number;
  error: string;
  duration?: number; // milliseconds for this attempt
};

export type DiagnosticSubagentRetryEvent = DiagnosticBaseEvent & {
  type: "subagent.retry";
  subagentId: string;
  attempt: number;
  runId: string;
  error: string;
  duration?: number; // milliseconds for this attempt
};

export type DiagnosticSkillRetryEvent = DiagnosticBaseEvent & {
  type: "skill.retry";
  skillName: string;
  attempt: number;
  error: string;
  duration?: number; // milliseconds for this attempt
};

export type DiagnosticAgentTurnRetryEvent = DiagnosticBaseEvent & {
  type: "agent-turn.retry";
  agentId: string;
  attempt: number;
  error: string;
  duration?: number; // milliseconds for this attempt
};

// Union type for all monitoring-related diagnostic events
export type DiagnosticMonitoringEvent =
  | DiagnosticRetryExhaustedEvent
  | DiagnosticToolRetryEvent
  | DiagnosticSubagentRetryEvent
  | DiagnosticSkillRetryEvent
  | DiagnosticAgentTurnRetryEvent;
