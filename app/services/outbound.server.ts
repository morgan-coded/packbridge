import crypto from "node:crypto";
import type { NormalizationEvent } from "@prisma/client";
import prisma from "../db.server";
import type { NormalizationResult } from "./normalizer.server";

/**
 * Outbound delivery:
 *  1. Look up merchant's webhook URL + signing secret from Shop.
 *  2. Build a stable JSON payload from the NormalizationJob + events.
 *  3. Sign with HMAC-SHA256 using the shop's signing secret.
 *  4. POST with signature + delivery ID headers.
 *  5. Retry up to 3 times with 1s / 5s / 15s delays on non-2xx or network error.
 *  6. Record every attempt in the OutboundDelivery table.
 *
 * Idempotent on (normalizationJobId, payloadHash) — re-running after a
 * successful delivery is a no-op.
 */

export interface OutboundPayload {
  packbridge_version: "1.0";
  shop: string;
  order_id: string;
  order_name: string;
  company: { id: string; name: string } | null;
  company_location: { id: string; name: string } | null;
  status: string;
  processed_at: string;
  idempotency_key: string;
  line_items: Array<{
    line_item_id: string;
    variant_id: string;
    sku: string | null;
    input_quantity: number;
    output_quantity: number | null;
    output_unit: string | null;
    pack_size: number | null;
    result: string;
    error_code?: string;
    remainder?: number;
    enforcement_mode?: string;
  }>;
}

export interface DeliveryOutcome {
  status: "delivered" | "failed" | "skipped" | "duplicate";
  deliveryId?: string;
  retryCount?: number;
  lastError?: string;
}

const RETRY_DELAYS_MS = [1000, 5000, 15000];

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

export async function buildPayload(
  shopDomain: string,
  result: NormalizationResult,
): Promise<OutboundPayload> {
  const { job, events } = result;

  const [company, location] = await Promise.all([
    job.companyId
      ? prisma.syncedCompany.findUnique({ where: { id: job.companyId } })
      : Promise.resolve(null),
    job.companyLocationId
      ? prisma.syncedCompanyLocation.findUnique({
          where: { id: job.companyLocationId },
        })
      : Promise.resolve(null),
  ]);

  return {
    packbridge_version: "1.0",
    shop: shopDomain,
    order_id: job.orderId,
    order_name: job.orderName,
    company: company ? { id: company.id, name: company.name } : null,
    company_location: location
      ? { id: location.id, name: location.name }
      : null,
    status: job.status,
    processed_at: (job.processedAt ?? job.createdAt).toISOString(),
    idempotency_key: job.idempotencyKey,
    line_items: events.map((e) => serializeEvent(e)),
  };
}

function serializeEvent(
  e: NormalizationEvent,
): OutboundPayload["line_items"][number] {
  const base = {
    line_item_id: e.lineItemId,
    variant_id: e.variantId,
    sku: e.sku,
    input_quantity: e.inputQuantity,
    output_quantity: e.outputQuantity ? Number(e.outputQuantity) : null,
    output_unit: e.outputUnit,
    pack_size: e.packSize,
    result: e.resultStatus,
  };
  const optional: Partial<OutboundPayload["line_items"][number]> = {};
  if (e.errorCode) optional.error_code = e.errorCode;
  if (e.remainder !== null && e.remainder !== undefined)
    optional.remainder = e.remainder;
  if (e.enforcementMode) optional.enforcement_mode = e.enforcementMode;
  return { ...base, ...optional };
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * HMAC-SHA256 of the raw JSON body using the shop's signing secret.
 * Returns `sha256=<hex>`, matching the canonical Shopify webhook convention.
 */
export function signPayload(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

export function hashPayload(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export interface DeliverOptions {
  /** Override `fetch` for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
  /** Override retry delays for tests. Defaults to [1000, 5000, 15000]. */
  retryDelaysMs?: number[];
}

export async function deliverPayload(
  shopDomain: string,
  result: NormalizationResult,
  options: DeliverOptions = {},
): Promise<DeliveryOutcome> {
  const shop = await prisma.shop.findUnique({ where: { id: shopDomain } });
  if (!shop) {
    console.warn(`[packbridge] no Shop row for ${shopDomain}; skip delivery`);
    return { status: "skipped", lastError: "shop_not_found" };
  }

  if (!shop.webhookUrl) {
    console.log(
      `[packbridge] ${shopDomain} has no webhookUrl configured; skip delivery`,
    );
    return { status: "skipped", lastError: "no_webhook_url" };
  }

  if (!shop.signingSecret) {
    console.warn(
      `[packbridge] ${shopDomain} missing signingSecret; skip delivery`,
    );
    return { status: "skipped", lastError: "no_signing_secret" };
  }

  const payload = await buildPayload(shopDomain, result);
  const body = JSON.stringify(payload);
  const payloadHash = hashPayload(body);

  // Duplicate detection: if we've already delivered this exact payload for
  // this job, skip.
  const duplicate = await prisma.outboundDelivery.findFirst({
    where: {
      normalizationJobId: result.job.id,
      payloadHash,
      deliveryStatus: "delivered",
    },
  });
  if (duplicate) {
    console.log(
      `[packbridge] duplicate delivery for job ${result.job.id}; skip`,
    );
    return {
      status: "duplicate",
      deliveryId: duplicate.id,
    };
  }

  const delivery = await prisma.outboundDelivery.create({
    data: {
      normalizationJobId: result.job.id,
      destinationType: "webhook",
      destinationRef: shop.webhookUrl,
      payloadHash,
      deliveryStatus: "pending",
      retryCount: 0,
    },
  });

  const signature = signPayload(body, shop.signingSecret);
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const fetchImpl = options.fetch ?? fetch;

  let lastError: string | null = null;
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      await prisma.outboundDelivery.update({
        where: { id: delivery.id },
        data: { retryCount: attempt },
      });
      console.log(
        `[packbridge] delivery retry ${attempt} for job ${result.job.id}`,
      );
    }

    try {
      const response = await fetchImpl(shop.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PackBridge-Signature": signature,
          "X-PackBridge-Delivery-Id": delivery.id,
        },
        body,
      });

      if (response.ok) {
        await prisma.outboundDelivery.update({
          where: { id: delivery.id },
          data: {
            deliveryStatus: "delivered",
            deliveredAt: new Date(),
            lastError: null,
          },
        });
        return {
          status: "delivered",
          deliveryId: delivery.id,
          retryCount: attempt,
        };
      }

      lastError = `HTTP ${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  await prisma.outboundDelivery.update({
    where: { id: delivery.id },
    data: {
      deliveryStatus: "failed",
      lastError,
      retryCount: delays.length,
    },
  });
  return {
    status: "failed",
    deliveryId: delivery.id,
    retryCount: delays.length,
    lastError: lastError ?? "unknown",
  };
}
