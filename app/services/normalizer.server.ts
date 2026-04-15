import type {
  NormalizationEvent,
  NormalizationJob,
} from "@prisma/client";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { toOrderGid } from "../lib/gid.server";
import { fetchOrderWithB2BContext } from "./orders.server";
import {
  resolveRule,
  validateLineItem,
} from "./rule-resolver.server";

type Admin = AdminApiContext;

export type OverallStatus = "completed" | "held" | "failed" | "skipped";

export interface NormalizationResult {
  job: NormalizationJob;
  events: NormalizationEvent[];
  overallStatus: OverallStatus;
  /** True when the order was not B2B and no work was performed. */
  skipped?: boolean;
}

/**
 * Compute the job-level status from per-line-item event outcomes.
 *
 * - Any `hold` → `held` (blocks downstream release)
 * - All `pass` → `completed`
 * - Mix of pass/warn/no_rule → `completed` (warnings don't block)
 */
export function computeOverallStatus(
  events: Array<Pick<NormalizationEvent, "resultStatus">>,
): Exclude<OverallStatus, "failed" | "skipped"> {
  if (events.some((e) => e.resultStatus === "hold")) return "held";
  return "completed";
}

/**
 * End-to-end order normalization. Idempotent by `orderGid` — re-running on the
 * same order returns the existing result without re-writing events (unless the
 * prior run failed, in which case it re-runs).
 */
export async function normalizeOrder(
  admin: Admin,
  shopDomain: string,
  orderId: string, // numeric ID from webhook payload (or a GID)
): Promise<NormalizationResult> {
  const orderGid = toOrderGid(orderId);
  const idempotencyKey = `normalize:${orderGid}`;

  // Step 1 — idempotency check
  const existing = await prisma.normalizationJob.findUnique({
    where: { idempotencyKey },
    include: { events: true },
  });

  if (existing && (existing.status === "completed" || existing.status === "held")) {
    return {
      job: existing,
      events: existing.events,
      overallStatus: existing.status as OverallStatus,
    };
  }

  if (existing && existing.status === "failed") {
    // Clear events and retry
    await prisma.normalizationEvent.deleteMany({
      where: { normalizationJobId: existing.id },
    });
    await prisma.normalizationJob.update({
      where: { id: existing.id },
      data: {
        status: "processing",
        errorSummary: null,
        processedAt: null,
      },
    });
  }

  // Step 2 — fetch order via GraphQL
  const order = await fetchOrderWithB2BContext(admin, orderGid);
  if (!order) {
    throw new Error(`Order ${orderGid} not found`);
  }

  const company = order.purchasingEntity?.company ?? null;
  const location = order.purchasingEntity?.location ?? null;

  if (!company) {
    // Not B2B — record a skipped job so we have an audit trail.
    const job = await prisma.normalizationJob.upsert({
      where: { idempotencyKey },
      create: {
        shopDomain,
        orderId: orderGid,
        orderName: order.name,
        companyId: null,
        companyLocationId: null,
        status: "skipped",
        idempotencyKey,
        processedAt: new Date(),
      },
      update: {
        status: "skipped",
        processedAt: new Date(),
      },
    });
    return { job, events: [], overallStatus: "skipped", skipped: true };
  }

  const companyId = company.id;
  const companyLocationId = location?.id ?? null;

  // Step 3 — create (or recover) the job
  const job = await prisma.normalizationJob.upsert({
    where: { idempotencyKey },
    create: {
      shopDomain,
      orderId: orderGid,
      orderName: order.name,
      companyId,
      companyLocationId,
      status: "processing",
      idempotencyKey,
    },
    update: {
      status: "processing",
      companyId,
      companyLocationId,
      orderName: order.name,
      errorSummary: null,
    },
  });

  try {
    // Step 4 — process each line item
    const events: NormalizationEvent[] = [];
    for (const li of order.lineItems) {
      if (!li.variant) {
        // Order had a deleted variant — record as no_rule with a synthetic
        // error so we don't lose the line.
        const ev = await prisma.normalizationEvent.create({
          data: {
            normalizationJobId: job.id,
            lineItemId: li.id,
            variantId: "unknown",
            sku: null,
            inputQuantity: li.quantity,
            resultStatus: "no_rule",
            errorCode: "VARIANT_DELETED",
          },
        });
        events.push(ev);
        continue;
      }

      const resolved = await resolveRule(
        shopDomain,
        companyId,
        companyLocationId,
        li.variant.id,
        li.variant.product.id,
      );
      const result = validateLineItem(resolved.rule, li.quantity);

      const ev = await prisma.normalizationEvent.create({
        data: {
          normalizationJobId: job.id,
          lineItemId: li.id,
          variantId: li.variant.id,
          sku: li.variant.sku,
          inputQuantity: li.quantity,
          resolvedRuleId: result.resolvedRuleId ?? null,
          packSize: result.packSize ?? null,
          outputQuantity: result.outputQuantity ?? null,
          outputUnit: result.outputUnit ?? null,
          resultStatus: result.status,
          errorCode: result.errorCode ?? null,
          remainder: result.remainder ?? null,
          enforcementMode: result.enforcementMode ?? null,
        },
      });
      events.push(ev);
    }

    // Step 5 — overall status
    const overallStatus = computeOverallStatus(events);
    const updated = await prisma.normalizationJob.update({
      where: { id: job.id },
      data: {
        status: overallStatus,
        processedAt: new Date(),
      },
    });

    return { job: updated, events, overallStatus };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await prisma.normalizationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorSummary: errorMessage.slice(0, 500),
        processedAt: new Date(),
      },
    });
    throw error;
  }
}
