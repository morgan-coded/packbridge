import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface JobRow {
  id: string;
  orderName: string;
  companyLabel: string;
  status: string;
  eventCount: number;
  processedAt: string | null;
  createdAt: string;
}

interface LoaderData {
  rows: JobRow[];
  filters: { status: string };
  totalUnfiltered: number;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";

  const where: Record<string, unknown> = { shopDomain };
  if (status) where.status = status;

  const [jobs, totalUnfiltered] = await Promise.all([
    prisma.normalizationJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { _count: { select: { events: true } } },
    }),
    prisma.normalizationJob.count({ where: { shopDomain } }),
  ]);

  const companyIds = Array.from(
    new Set(jobs.map((j) => j.companyId).filter(Boolean)),
  ) as string[];
  const companies = companyIds.length
    ? await prisma.syncedCompany.findMany({
        where: { id: { in: companyIds } },
      })
    : [];
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  return {
    rows: jobs.map((j) => ({
      id: j.id,
      orderName: j.orderName,
      companyLabel: j.companyId
        ? (companyMap.get(j.companyId) ?? "Unknown company")
        : "—",
      status: j.status,
      eventCount: j._count.events,
      processedAt: j.processedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    })),
    filters: { status },
    totalUnfiltered,
  };
};

export function statusTone(
  status: string,
): "success" | "warning" | "critical" | "neutral" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "held":
      return "warning";
    case "failed":
      return "critical";
    case "pending":
    case "processing":
      return "info";
    case "skipped":
      return "neutral";
    default:
      return "neutral";
  }
}

export default function JobsIndex() {
  const { rows, filters, totalUnfiltered } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  return (
    <s-page heading="Normalization jobs">
      <s-section heading="Filters">
        <s-stack direction="inline" gap="base">
          <s-select
            label="Status"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.currentTarget.value)}
          >
            <s-option value="">All</s-option>
            <s-option value="completed">Completed</s-option>
            <s-option value="held">Held</s-option>
            <s-option value="failed">Failed</s-option>
            <s-option value="pending">Pending</s-option>
            <s-option value="processing">Processing</s-option>
            <s-option value="skipped">Skipped (non-B2B)</s-option>
          </s-select>
        </s-stack>
      </s-section>

      <s-section heading={`Jobs (${rows.length} of ${totalUnfiltered})`}>
        {rows.length === 0 ? (
          <s-paragraph>
            {totalUnfiltered === 0
              ? "No normalization jobs yet. B2B orders will appear here once they’re processed."
              : "No jobs match the current filter."}
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Order</s-table-header>
              <s-table-header>Company</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header format="numeric">Lines</s-table-header>
              <s-table-header>Processed</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>
                    <Link to={`/app/jobs/${row.id}`}>{row.orderName}</Link>
                  </s-table-cell>
                  <s-table-cell>{row.companyLabel}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(row.status)}>
                      {row.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{row.eventCount}</s-table-cell>
                  <s-table-cell>
                    {row.processedAt
                      ? new Date(row.processedAt).toLocaleString()
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(row.createdAt).toLocaleString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
