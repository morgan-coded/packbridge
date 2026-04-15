import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { runFullSync } from "../services/sync.server";
import { statusTone } from "./app.jobs._index";

interface RecentJob {
  id: string;
  orderName: string;
  companyLabel: string | null;
  status: string;
  createdAt: string;
}

interface LoaderData {
  shopDomain: string;
  syncedAt: string | null;
  stats: {
    activeRules: number;
    totalProcessed: number;
    completed: number;
    held: number;
    failed: number;
    today: number;
  };
  recent: RecentJob[];
  /** True when merchant still needs to complete onboarding. */
  showChecklist: boolean;
  checklist: {
    hasRules: boolean;
    hasImported: boolean;
    hasWebhookUrl: boolean;
    hasProcessedOrder: boolean;
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
    activeRules,
    totalRules,
    totalProcessed,
    completed,
    held,
    failed,
    today,
    recentJobsRaw,
    importJobs,
  ] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopDomain } }),
    prisma.packRule.count({ where: { shopDomain, active: true } }),
    prisma.packRule.count({ where: { shopDomain } }),
    prisma.normalizationJob.count({ where: { shopDomain } }),
    prisma.normalizationJob.count({
      where: { shopDomain, status: "completed" },
    }),
    prisma.normalizationJob.count({ where: { shopDomain, status: "held" } }),
    prisma.normalizationJob.count({
      where: { shopDomain, status: "failed" },
    }),
    prisma.normalizationJob.count({
      where: { shopDomain, createdAt: { gte: startOfToday() } },
    }),
    prisma.normalizationJob.findMany({
      where: { shopDomain },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.ruleImportJob.count({
      where: { shopDomain, status: "succeeded" },
    }),
  ]);

  const companyIds = Array.from(
    new Set(recentJobsRaw.map((j) => j.companyId).filter(Boolean)),
  ) as string[];
  const companies = companyIds.length
    ? await prisma.syncedCompany.findMany({
        where: { id: { in: companyIds } },
      })
    : [];
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  return {
    shopDomain,
    syncedAt: shop?.syncedAt ? shop.syncedAt.toISOString() : null,
    stats: {
      activeRules,
      totalProcessed,
      completed,
      held,
      failed,
      today,
    },
    recent: recentJobsRaw.map((j) => ({
      id: j.id,
      orderName: j.orderName,
      companyLabel: j.companyId
        ? (companyMap.get(j.companyId) ?? "Unknown company")
        : null,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    })),
    showChecklist: totalRules < 3,
    checklist: {
      hasRules: totalRules > 0,
      hasImported: importJobs > 0,
      hasWebhookUrl: Boolean(shop?.webhookUrl),
      hasProcessedOrder: totalProcessed > 0,
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
    console.error(
      `[packbridge] manual sync failed for ${session.shop}:`,
      error,
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

function ChecklistItem({
  done,
  children,
}: {
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <s-paragraph>
      <s-text tone={done ? "success" : "neutral"}>
        {done ? "✓ " : "☐ "}
      </s-text>
      {children}
    </s-paragraph>
  );
}

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

      <s-section heading="PackBridge">
        <s-paragraph>
          <s-text>
            Translate B2B orders into downstream-safe pack units — each → inner
            → case → pallet — and deliver signed payloads to your ERP, EDI, or
            warehouse system.
          </s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text tone="neutral">
            Shop: <strong>{data.shopDomain}</strong> · Last synced:{" "}
            <strong>{syncedLabel}</strong>
          </s-text>
        </s-paragraph>
      </s-section>

      <s-section heading="At a glance">
        <s-stack direction="inline" gap="large">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Active rules</s-text>
              <s-heading>{data.stats.activeRules}</s-heading>
            </s-stack>
          </s-box>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Orders processed</s-text>
              <s-heading>{data.stats.totalProcessed}</s-heading>
            </s-stack>
          </s-box>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Completed</s-text>
              <s-heading>{data.stats.completed}</s-heading>
            </s-stack>
          </s-box>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Held / needs review</s-text>
              <s-heading>{data.stats.held}</s-heading>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {data.showChecklist && (
        <s-section heading="Getting started">
          <s-stack direction="block" gap="small">
            <ChecklistItem done={true}>App installed</ChecklistItem>
            <ChecklistItem done={data.checklist.hasRules}>
              <s-link href="/app/rules/new">Create your first pack rule</s-link>
            </ChecklistItem>
            <ChecklistItem done={data.checklist.hasImported}>
              <s-link href="/app/rules/import">Import rules via CSV</s-link>
            </ChecklistItem>
            <ChecklistItem done={data.checklist.hasWebhookUrl}>
              <s-link href="/app/settings">
                Configure webhook destination
              </s-link>
            </ChecklistItem>
            <ChecklistItem done={data.checklist.hasProcessedOrder}>
              Place a test B2B order
            </ChecklistItem>
          </s-stack>
        </s-section>
      )}

      <s-section heading="Recent jobs">
        {data.recent.length === 0 ? (
          <s-paragraph>
            No orders processed yet. B2B orders will show up here within a
            second of being created.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Order</s-table-header>
              <s-table-header>Company</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>When</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.recent.map((j) => (
                <s-table-row key={j.id}>
                  <s-table-cell>
                    <Link to={`/app/jobs/${j.id}`}>{j.orderName}</Link>
                  </s-table-cell>
                  <s-table-cell>{j.companyLabel ?? "—"}</s-table-cell>
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
        )}
        <s-link href="/app/jobs">View all jobs →</s-link>
      </s-section>

      {data.stats.failed > 0 && (
        <s-section heading="Attention">
          <s-banner tone="critical" heading={`${data.stats.failed} failed job${data.stats.failed === 1 ? "" : "s"}`}>
            <s-paragraph>
              One or more jobs failed to normalize or deliver. Open{" "}
              <s-link href="/app/jobs?status=failed">the failed jobs</s-link> to
              see the error details.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      <s-section slot="aside" heading="Quick links">
        <s-stack direction="block" gap="small">
          <s-link href="/app/rules">Pack rules</s-link>
          <s-link href="/app/rules/import">Import CSV</s-link>
          <s-link href="/app/jobs">Jobs</s-link>
          <s-link href="/app/settings">Settings</s-link>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Today">
        <s-paragraph>
          <s-text>Orders processed today: </s-text>
          <strong>{data.stats.today}</strong>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
