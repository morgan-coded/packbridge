import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { statusTone } from "./app.jobs._index";

interface JobDetailLoader {
  job: {
    id: string;
    orderName: string;
    orderId: string;
    status: string;
    companyLabel: string | null;
    companyLocationLabel: string | null;
    processedAt: string | null;
    createdAt: string;
    idempotencyKey: string;
    errorSummary: string | null;
  };
  events: Array<{
    id: string;
    sku: string | null;
    variantId: string;
    inputQuantity: number;
    outputQuantity: number | null;
    outputUnit: string | null;
    packSize: number | null;
    resultStatus: string;
    errorCode: string | null;
    remainder: number | null;
  }>;
  delivery: {
    destinationRef: string | null;
    deliveryStatus: string;
    retryCount: number;
    lastError: string | null;
    deliveredAt: string | null;
  } | null;
}

function eventTone(status: string): ReturnType<typeof statusTone> {
  switch (status) {
    case "pass":
      return "success";
    case "warn":
      return "warning";
    case "hold":
      return "critical";
    case "no_rule":
      return "neutral";
    default:
      return "neutral";
  }
}

export const loader = async ({
  request,
  params,
}: LoaderFunctionArgs): Promise<JobDetailLoader> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const id = params.id!;

  const job = await prisma.normalizationJob.findFirst({
    where: { id, shopDomain },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!job) throw new Response("Job not found", { status: 404 });

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

  const delivery = job.deliveries[0] ?? null;

  return {
    job: {
      id: job.id,
      orderName: job.orderName,
      orderId: job.orderId,
      status: job.status,
      companyLabel: company?.name ?? null,
      companyLocationLabel: location?.name ?? null,
      processedAt: job.processedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      idempotencyKey: job.idempotencyKey,
      errorSummary: job.errorSummary,
    },
    events: job.events.map((e) => ({
      id: e.id,
      sku: e.sku,
      variantId: e.variantId,
      inputQuantity: e.inputQuantity,
      outputQuantity: e.outputQuantity ? Number(e.outputQuantity) : null,
      outputUnit: e.outputUnit,
      packSize: e.packSize,
      resultStatus: e.resultStatus,
      errorCode: e.errorCode,
      remainder: e.remainder,
    })),
    delivery: delivery
      ? {
          destinationRef: delivery.destinationRef,
          deliveryStatus: delivery.deliveryStatus,
          retryCount: delivery.retryCount,
          lastError: delivery.lastError,
          deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        }
      : null,
  };
};

export default function JobDetail() {
  const { job, events, delivery } = useLoaderData<typeof loader>();

  return (
    <s-page heading={`Job — order ${job.orderName}`}>
      <s-button slot="secondary-actions" href="/app/jobs">
        All jobs
      </s-button>

      <s-section heading="Order summary">
        <s-stack direction="block" gap="small">
          <s-paragraph>
            <s-text>Order: </s-text>
            <strong>{job.orderName}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Order GID: </s-text>
            <code>{job.orderId}</code>
          </s-paragraph>
          <s-paragraph>
            <s-text>Company: </s-text>
            <strong>{job.companyLabel ?? "—"}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Company location: </s-text>
            <strong>{job.companyLocationLabel ?? "—"}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Status: </s-text>
            <s-badge tone={statusTone(job.status)}>{job.status}</s-badge>
          </s-paragraph>
          <s-paragraph>
            <s-text>Processed at: </s-text>
            <strong>
              {job.processedAt
                ? new Date(job.processedAt).toLocaleString()
                : "—"}
            </strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Idempotency key: </s-text>
            <code>{job.idempotencyKey}</code>
          </s-paragraph>
          {job.errorSummary && (
            <s-banner tone="critical" heading="Normalization error">
              <s-paragraph>{job.errorSummary}</s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading={`Line items (${events.length})`}>
        {events.length === 0 ? (
          <s-paragraph>No line-item events recorded for this job.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Variant</s-table-header>
              <s-table-header format="numeric">Input qty</s-table-header>
              <s-table-header format="numeric">Output qty</s-table-header>
              <s-table-header>Output unit</s-table-header>
              <s-table-header format="numeric">Pack size</s-table-header>
              <s-table-header>Result</s-table-header>
              <s-table-header>Error</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {events.map((e) => (
                <s-table-row key={e.id}>
                  <s-table-cell>{e.sku ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <code>{e.variantId}</code>
                  </s-table-cell>
                  <s-table-cell>{e.inputQuantity}</s-table-cell>
                  <s-table-cell>{e.outputQuantity ?? "—"}</s-table-cell>
                  <s-table-cell>{e.outputUnit ?? "—"}</s-table-cell>
                  <s-table-cell>{e.packSize ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={eventTone(e.resultStatus)}>
                      {e.resultStatus}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {e.errorCode ? (
                      <s-text tone="critical">
                        {e.errorCode}
                        {e.remainder !== null && e.remainder !== undefined
                          ? ` (remainder ${e.remainder})`
                          : ""}
                      </s-text>
                    ) : (
                      "—"
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading="Delivery status">
        {!delivery ? (
          <s-paragraph>
            No outbound delivery attempted yet. This can mean the shop has no
            webhook URL configured, the order is non-B2B, or delivery is still
            in flight.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            <s-paragraph>
              <s-text>Destination: </s-text>
              <code>{delivery.destinationRef ?? "—"}</code>
            </s-paragraph>
            <s-paragraph>
              <s-text>Status: </s-text>
              <s-badge tone={statusTone(delivery.deliveryStatus)}>
                {delivery.deliveryStatus}
              </s-badge>
            </s-paragraph>
            <s-paragraph>
              <s-text>Retry count: </s-text>
              <strong>{delivery.retryCount}</strong>
            </s-paragraph>
            {delivery.deliveredAt && (
              <s-paragraph>
                <s-text>Delivered at: </s-text>
                <strong>
                  {new Date(delivery.deliveredAt).toLocaleString()}
                </strong>
              </s-paragraph>
            )}
            {delivery.lastError && (
              <s-banner tone="critical" heading="Last delivery error">
                <s-paragraph>{delivery.lastError}</s-paragraph>
              </s-banner>
            )}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
