import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { runFullSync } from "../services/sync.server";
import { statusTone } from "./app.jobs._index";

interface RecentJob {
  id: string;
  orderName: string;
  status: string;
  createdAt: string;
}

interface LoaderData {
  shopDomain: string;
  companyCount: number;
  locationCount: number;
  variantCount: number;
  syncedAt: string | null;
  jobs: {
    total: number;
    today: number;
    completed: number;
    held: number;
    failed: number;
    recent: RecentJob[];
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const [
    shop,
    companyCount,
    locationCount,
    variantCount,
    totalJobs,
    todayJobs,
    completedJobs,
    heldJobs,
    failedJobs,
    recentJobs,
  ] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopDomain } }),
    prisma.syncedCompany.count({ where: { shopDomain } }),
    prisma.syncedCompanyLocation.count({ where: { shopDomain } }),
    prisma.syncedVariant.count({ where: { shopDomain } }),
    prisma.normalizationJob.count({ where: { shopDomain } }),
    prisma.normalizationJob.count({
      where: { shopDomain, createdAt: { gte: startOfToday() } },
    }),
    prisma.normalizationJob.count({
      where: { shopDomain, status: "completed" },
    }),
    prisma.normalizationJob.count({ where: { shopDomain, status: "held" } }),
    prisma.normalizationJob.count({
      where: { shopDomain, status: "failed" },
    }),
    prisma.normalizationJob.findMany({
      where: { shopDomain },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    shopDomain,
    companyCount,
    locationCount,
    variantCount,
    syncedAt: shop?.syncedAt ? shop.syncedAt.toISOString() : null,
    jobs: {
      total: totalJobs,
      today: todayJobs,
      completed: completedJobs,
      held: heldJobs,
      failed: failedJobs,
      recent: recentJobs.map((j) => ({
        id: j.id,
        orderName: j.orderName,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
      })),
    },
  };
};

interface ActionData {
  ok: boolean;
  counts?: { companies: number; locations: number; variants: number };
  error?: string;
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { admin, session } = await authenticate.admin(request);
  try {
    const counts = await runFullSync(admin, session.shop);
    return { ok: true, counts };
  } catch (error) {
    console.error(`[packbridge] manual sync failed for ${session.shop}:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSyncing =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Sync complete");
    } else if (fetcher.data && fetcher.data.ok === false) {
      shopify.toast.show("Sync failed — see server logs", { isError: true });
    }
  }, [fetcher.data, shopify]);

  const resync = () => fetcher.submit({}, { method: "POST" });

  const syncedLabel = data.syncedAt
    ? new Date(data.syncedAt).toLocaleString()
    : "Never";

  return (
    <s-page heading="PackBridge">
      <s-button
        slot="primary-action"
        onClick={resync}
        {...(isSyncing ? { loading: true } : {})}
      >
        Re-sync now
      </s-button>

      <s-section heading="Shop">
        <s-paragraph>
          <s-text>Shop domain: </s-text>
          <strong>{data.shopDomain}</strong>
        </s-paragraph>
        <s-paragraph>
          <s-text>Last synced: </s-text>
          <strong>{syncedLabel}</strong>
        </s-paragraph>
      </s-section>

      <s-section heading="Mirrored data">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text>Companies: </s-text>
            <strong>{data.companyCount}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Company locations: </s-text>
            <strong>{data.locationCount}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Variants: </s-text>
            <strong>{data.variantCount}</strong>
          </s-paragraph>
        </s-stack>

        {fetcher.data?.ok && fetcher.data.counts && (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>
              Synced {fetcher.data.counts.companies} companies,{" "}
              {fetcher.data.counts.locations} locations, and{" "}
              {fetcher.data.counts.variants} variants.
            </s-paragraph>
          </s-box>
        )}

        {fetcher.data && fetcher.data.ok === false && (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>Sync failed: {fetcher.data.error}</s-paragraph>
          </s-box>
        )}
      </s-section>

      <s-section heading="Normalization jobs">
        <s-stack direction="inline" gap="large">
          <s-stack direction="block" gap="small">
            <s-text tone="neutral">Total (all time)</s-text>
            <s-heading>{data.jobs.total}</s-heading>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text tone="neutral">Today</s-text>
            <s-heading>{data.jobs.today}</s-heading>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text tone="neutral">Completed</s-text>
            <s-heading>{data.jobs.completed}</s-heading>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text tone="neutral">Held</s-text>
            <s-heading>{data.jobs.held}</s-heading>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text tone="neutral">Failed</s-text>
            <s-heading>{data.jobs.failed}</s-heading>
          </s-stack>
        </s-stack>

        {data.jobs.recent.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header>Order</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>When</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.jobs.recent.map((j) => (
                <s-table-row key={j.id}>
                  <s-table-cell>
                    <Link to={`/app/jobs/${j.id}`}>{j.orderName}</Link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(j.status)}>{j.status}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(j.createdAt).toLocaleString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>
            No jobs yet. B2B orders will show up here once processed.
          </s-paragraph>
        )}

        <s-link href="/app/jobs">View all jobs →</s-link>
      </s-section>

      <s-section slot="aside" heading="Quick links">
        <s-stack direction="block" gap="small">
          <s-link href="/app/rules">Pack rules</s-link>
          <s-link href="/app/jobs">Jobs</s-link>
          <s-link href="/app/settings">Settings</s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
