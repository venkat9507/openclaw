/**
 * Failure notification system for retry exhaustion events.
 * Sends alerts to user's connected channel (Telegram/WhatsApp/Discord/etc).
 */

import type { OpenClawConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import type { RetryableOperationKind, RetryTrackerEvent } from "../infra/retry-tracker.js";
import type { DeliveryContext } from "../utils/delivery-context.js";

export type FailureNotificationParams = {
  kind: RetryableOperationKind;
  operationLabel: string;
  attempts: number;
  lastError: string;
  deliveryContext?: DeliveryContext;
};

/**
 * Send a failure notification to the user's connected channel.
 * Returns true if notification was sent successfully.
 */
export async function sendFailureNotification(params: FailureNotificationParams): Promise<boolean> {
  if (!params.deliveryContext) {
    // No delivery context, can't send notification
    return false;
  }

  const kindLabel =
    params.kind === "subagent"
      ? "Sub-agent task"
      : params.kind === "tool"
        ? "Tool call"
        : params.kind === "skill"
          ? "Skill execution"
          : "Agent turn";

  const message = `⚠️ ${kindLabel} "${params.operationLabel}" failed after ${params.attempts} attempts.
Error: ${params.lastError.substring(0, 200)}${params.lastError.length > 200 ? "..." : ""}
Run \`openclaw logs --follow\` for details.`;

  try {
    await callGateway({
      method: "agent",
      params: {
        message,
        deliver: true,
        channel: params.deliveryContext.channel,
        to: params.deliveryContext.to,
        accountId: params.deliveryContext.accountId,
        threadId:
          params.deliveryContext.threadId != null
            ? String(params.deliveryContext.threadId)
            : undefined,
      },
      timeoutMs: 10_000,
    });

    return true;
  } catch (error) {
    // Log the failure but don't throw - notification failures should not break retry tracking
    console.warn(
      `Failed to send failure notification: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

/**
 * Create a failure notification handler for the retry tracker.
 * This handler is invoked on retry exhaustion events.
 */
export function createFailureNotificationHandler(opts: {
  cfg: OpenClawConfig;
  defaultDeliveryContext?: DeliveryContext;
}): (event: RetryTrackerEvent) => Promise<void> {
  // Rate limiting: track last notification time per operation kind
  const lastNotificationTimeMs = new Map<RetryableOperationKind, number>();
  const defaultCooldownMs = opts.cfg.agents?.defaults?.retry?.notifications?.cooldownMs ?? 300_000; // 5 minutes

  return async (event: RetryTrackerEvent) => {
    // Only send on exhaustion phase
    if (event.phase !== "exhausted") {
      return;
    }

    const { state } = event;
    const { kind, operationId, lastError, attempt, maxAttempts } = state;

    // Rate limit: check if we recently sent a notification for this operation kind
    const lastTime = lastNotificationTimeMs.get(kind) ?? 0;
    const now = Date.now();
    if (now - lastTime < defaultCooldownMs) {
      // Still in cooldown, skip notification
      return;
    }

    // Update last notification time
    lastNotificationTimeMs.set(kind, now);

    // Prefer per-event delivery context (from subagent requesterOrigin), fall back to default
    const eventDeliveryContext =
      (state.deliveryContext as DeliveryContext | undefined) ?? opts.defaultDeliveryContext;

    // Send notification
    await sendFailureNotification({
      kind,
      operationLabel: operationId,
      attempts: attempt,
      lastError: lastError || "Unknown error",
      deliveryContext: eventDeliveryContext,
    });
  };
}
