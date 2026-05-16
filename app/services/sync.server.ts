import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

type Admin = AdminApiContext;

const COMPANIES_QUERY = `#graphql
  query PackBridgeSyncCompanies($cursor: String) {
    companies(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          externalId
          locations(first: 50) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCTS_QUERY = `#graphql
  query PackBridgeSyncProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          variants(first: 100) {
            edges {
              node {
                id
                sku
                title
              }
            }
          }
        }
      }
    }
  }
`;

const SHOP_QUERY = `#graphql
  query PackBridgeShopMetadata {
    shop {
      name
      myshopifyDomain
      currencyCode
      plan { displayName }
    }
  }
`;

interface SyncCounts {
  companies: number;
  locations: number;
  variants: number;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface Connection<T> {
  pageInfo: PageInfo;
  edges: Array<{ node: T }>;
}

interface CompanyNode {
  id: string;
  name: string;
  externalId: string | null;
  locations: Connection<{ id: string; name: string }>;
}

interface VariantNode {
  id: string;
  sku: string | null;
  title: string | null;
}

interface ProductNode {
  id: string;
  title: string;
  variants: Connection<VariantNode>;
}

interface ShopMetadata {
  name?: string;
  myshopifyDomain?: string;
  currencyCode?: string;
  plan?: { displayName?: string };
}

interface GraphQLEnvelope<TData> {
  data?: TData;
  errors?: unknown;
}

/**
 * Fetch every B2B company and its locations, upserting into the mirror tables.
 */
export async function syncCompanies(
  admin: Admin,
  shopDomain: string,
): Promise<{ companies: number; locations: number }> {
  let cursor: string | null = null;
  let companyCount = 0;
  let locationCount = 0;

  do {
    const response = await admin.graphql(COMPANIES_QUERY, {
      variables: { cursor },
    });
    const body = (await response.json()) as GraphQLEnvelope<{
      companies: Connection<CompanyNode>;
    }>;

    if (body.errors) {
      throw new Error(
        `syncCompanies GraphQL error: ${JSON.stringify(body.errors)}`,
      );
    }

    const connection = body.data?.companies;
    if (!connection) break;

    for (const edge of connection.edges ?? []) {
      const company = edge.node;
      await prisma.syncedCompany.upsert({
        where: { id: company.id },
        create: {
          id: company.id,
          shopDomain,
          name: company.name,
          externalId: company.externalId ?? null,
          syncedAt: new Date(),
        },
        update: {
          shopDomain,
          name: company.name,
          externalId: company.externalId ?? null,
          syncedAt: new Date(),
        },
      });
      companyCount += 1;

      for (const locEdge of company.locations?.edges ?? []) {
        const loc = locEdge.node;
        await prisma.syncedCompanyLocation.upsert({
          where: { id: loc.id },
          create: {
            id: loc.id,
            companyId: company.id,
            shopDomain,
            name: loc.name,
            syncedAt: new Date(),
          },
          update: {
            companyId: company.id,
            shopDomain,
            name: loc.name,
            syncedAt: new Date(),
          },
        });
        locationCount += 1;
      }
    }

    cursor = connection.pageInfo?.hasNextPage
      ? (connection.pageInfo.endCursor as string)
      : null;
  } while (cursor);

  return { companies: companyCount, locations: locationCount };
}

/**
 * Fetch every product and variant, upserting variants into the mirror table.
 */
export async function syncVariants(
  admin: Admin,
  shopDomain: string,
): Promise<{ variants: number }> {
  let cursor: string | null = null;
  let variantCount = 0;

  do {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { cursor },
    });
    const body = (await response.json()) as GraphQLEnvelope<{
      products: Connection<ProductNode>;
    }>;

    if (body.errors) {
      throw new Error(
        `syncVariants GraphQL error: ${JSON.stringify(body.errors)}`,
      );
    }

    const connection = body.data?.products;
    if (!connection) break;

    for (const edge of connection.edges ?? []) {
      const product = edge.node;
      for (const variantEdge of product.variants?.edges ?? []) {
        const variant = variantEdge.node;
        await prisma.syncedVariant.upsert({
          where: { id: variant.id },
          create: {
            id: variant.id,
            shopDomain,
            productId: product.id,
            sku: variant.sku ?? null,
            title: variant.title ?? null,
            productTitle: product.title ?? null,
            syncedAt: new Date(),
          },
          update: {
            shopDomain,
            productId: product.id,
            sku: variant.sku ?? null,
            title: variant.title ?? null,
            productTitle: product.title ?? null,
            syncedAt: new Date(),
          },
        });
        variantCount += 1;
      }
    }

    cursor = connection.pageInfo?.hasNextPage
      ? (connection.pageInfo.endCursor as string)
      : null;
  } while (cursor);

  return { variants: variantCount };
}

/**
 * Upsert the Shop row, then run company + variant syncs.
 */
export async function runFullSync(
  admin: Admin,
  shopDomain: string,
): Promise<SyncCounts> {
  const shopResponse = await admin.graphql(SHOP_QUERY);
  const shopBody = (await shopResponse.json()) as GraphQLEnvelope<{
    shop: ShopMetadata;
  }>;
  const shop = shopBody.data?.shop;

  await prisma.shop.upsert({
    where: { id: shopDomain },
    create: {
      id: shopDomain,
      name: shop?.name ?? null,
      plan: shop?.plan?.displayName ?? null,
      currency: shop?.currencyCode ?? null,
      syncedAt: new Date(),
    },
    update: {
      name: shop?.name ?? null,
      plan: shop?.plan?.displayName ?? null,
      currency: shop?.currencyCode ?? null,
      syncedAt: new Date(),
    },
  });

  const companyResult = await syncCompanies(admin, shopDomain);
  const variantResult = await syncVariants(admin, shopDomain);

  await prisma.shop.update({
    where: { id: shopDomain },
    data: { syncedAt: new Date() },
  });

  return {
    companies: companyResult.companies,
    locations: companyResult.locations,
    variants: variantResult.variants,
  };
}
