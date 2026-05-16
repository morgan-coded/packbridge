import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface RuleRow {
  id: string;
  companyLabel: string;
  locationLabel: string;
  sku: string;
  productLabel: string;
  packSize: number;
  downstreamUnitCode: string;
  enforcementMode: string;
  active: boolean;
  createdAt: string;
}

interface LoaderData {
  rows: RuleRow[];
  companies: Array<{ id: string; name: string }>;
  filters: {
    companyId: string;
    mode: string;
    active: string;
    search: string;
  };
  totalUnfiltered: number;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const companyFilter = url.searchParams.get("company") ?? "";
  const modeFilter = url.searchParams.get("mode") ?? "";
  const activeFilter = url.searchParams.get("active") ?? "";
  const search = url.searchParams.get("q") ?? "";

  const where: Record<string, unknown> = { shopDomain };
  if (companyFilter) where.companyId = companyFilter;
  if (modeFilter) where.enforcementMode = modeFilter;
  if (activeFilter === "active") where.active = true;
  if (activeFilter === "inactive") where.active = false;

  const [rulesRaw, companies, totalUnfiltered] = await Promise.all([
    prisma.packRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.syncedCompany.findMany({
      where: { shopDomain },
      orderBy: { name: "asc" },
    }),
    prisma.packRule.count({ where: { shopDomain } }),
  ]);

  // Fetch joined display data in one pass
  const companyIds = Array.from(
    new Set(rulesRaw.map((r) => r.companyId).filter(Boolean)),
  ) as string[];
  const locationIds = Array.from(
    new Set(rulesRaw.map((r) => r.companyLocationId).filter(Boolean)),
  ) as string[];
  const variantIds = Array.from(
    new Set(rulesRaw.map((r) => r.variantId).filter(Boolean)),
  ) as string[];
  const productIds = Array.from(
    new Set(rulesRaw.map((r) => r.productId).filter(Boolean)),
  ) as string[];

  const [companyLookup, locationLookup, variantLookup] = await Promise.all([
    companyIds.length
      ? prisma.syncedCompany.findMany({ where: { id: { in: companyIds } } })
      : [],
    locationIds.length
      ? prisma.syncedCompanyLocation.findMany({
          where: { id: { in: locationIds } },
        })
      : [],
    variantIds.length
      ? prisma.syncedVariant.findMany({ where: { id: { in: variantIds } } })
      : [],
  ]);

  const productLookup = productIds.length
    ? await prisma.syncedVariant.findMany({
        where: { productId: { in: productIds } },
        distinct: ["productId"],
      })
    : [];

  const companyMap = new Map(companyLookup.map((c) => [c.id, c]));
  const locationMap = new Map(locationLookup.map((l) => [l.id, l]));
  const variantMap = new Map(variantLookup.map((v) => [v.id, v]));
  const productMap = new Map(productLookup.map((v) => [v.productId, v]));

  let rows: RuleRow[] = rulesRaw.map((r) => {
    const company = r.companyId ? companyMap.get(r.companyId) : null;
    const location = r.companyLocationId
      ? locationMap.get(r.companyLocationId)
      : null;
    const variant = r.variantId ? variantMap.get(r.variantId) : null;
    const productFallback = r.productId ? productMap.get(r.productId) : null;
    return {
      id: r.id,
      companyLabel: company ? company.name : "All companies",
      locationLabel: r.companyId
        ? location
          ? location.name
          : "All locations"
        : "—",
      sku: variant?.sku ?? "—",
      productLabel:
        variant?.productTitle ??
        productFallback?.productTitle ??
        (r.variantId || r.productId ? "Unknown product" : "All products"),
      packSize: r.packSize,
      downstreamUnitCode: r.downstreamUnitCode,
      enforcementMode: r.enforcementMode,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    };
  });

  if (search) {
    const lower = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(lower) ||
        r.productLabel.toLowerCase().includes(lower),
    );
  }

  return {
    rows,
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    filters: {
      companyId: companyFilter,
      mode: modeFilter,
      active: activeFilter,
      search,
    },
    totalUnfiltered,
  };
};

function modeBadgeColor(mode: string): "info" | "warning" | "critical" {
  if (mode === "hold") return "critical";
  if (mode === "normalize_only") return "info";
  return "warning";
}

export default function RulesIndex() {
  const { rows, companies, filters, totalUnfiltered } =
    useLoaderData<typeof loader>();
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
    <s-page heading="Pack rules">
      <s-button slot="primary-action" href="/app/rules/new">
        Create rule
      </s-button>
      <s-button slot="secondary-actions" href="/app/rules/import">
        Import CSV
      </s-button>

      <s-section heading="Filters">
        <s-stack direction="inline" gap="base">
          <s-select
            label="Company"
            value={filters.companyId}
            onChange={(e) => updateFilter("company", e.currentTarget.value)}
          >
            <s-option value="">All companies</s-option>
            {companies.map((c) => (
              <s-option key={c.id} value={c.id}>
                {c.name}
              </s-option>
            ))}
          </s-select>

          <s-select
            label="Enforcement mode"
            value={filters.mode}
            onChange={(e) => updateFilter("mode", e.currentTarget.value)}
          >
            <s-option value="">All modes</s-option>
            <s-option value="warn">Warn</s-option>
            <s-option value="hold">Hold</s-option>
            <s-option value="normalize_only">Normalize only</s-option>
          </s-select>

          <s-select
            label="Status"
            value={filters.active}
            onChange={(e) => updateFilter("active", e.currentTarget.value)}
          >
            <s-option value="">All</s-option>
            <s-option value="active">Active</s-option>
            <s-option value="inactive">Inactive</s-option>
          </s-select>

          <s-search-field
            label="Search SKU or product"
            value={filters.search}
            onInput={(e) => updateFilter("q", e.currentTarget.value)}
          />
        </s-stack>
      </s-section>

      <s-section heading={`Rules (${rows.length} of ${totalUnfiltered})`}>
        {rows.length === 0 ? (
          <s-paragraph>
            {totalUnfiltered === 0
              ? "No pack rules yet. Create one or import a CSV to get started."
              : "No rules match the current filters."}
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Company</s-table-header>
              <s-table-header>Location</s-table-header>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header format="numeric">Pack size</s-table-header>
              <s-table-header>Unit code</s-table-header>
              <s-table-header>Mode</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>
                    <Link to={`/app/rules/${row.id}`}>{row.companyLabel}</Link>
                  </s-table-cell>
                  <s-table-cell>{row.locationLabel}</s-table-cell>
                  <s-table-cell>{row.sku}</s-table-cell>
                  <s-table-cell>{row.productLabel}</s-table-cell>
                  <s-table-cell>{row.packSize}</s-table-cell>
                  <s-table-cell>{row.downstreamUnitCode}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={modeBadgeColor(row.enforcementMode)}>
                      {row.enforcementMode}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={row.active ? "success" : "neutral"}>
                      {row.active ? "Active" : "Inactive"}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(row.createdAt).toLocaleDateString()}
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
