/**
 * Shopify GID (Global ID) helpers.
 *
 * Webhook payloads deliver numeric IDs (e.g. `123456789`), while the Admin
 * GraphQL API requires Global IDs (e.g. `gid://shopify/Order/123456789`).
 * These helpers bridge the two representations.
 */

export type NumericIdLike = string | number | bigint;

function normalize(id: NumericIdLike): string {
  return typeof id === "string" ? id : id.toString();
}

function toGid(resource: string, id: NumericIdLike): string {
  const value = normalize(id);
  if (value.startsWith("gid://shopify/")) {
    return value;
  }
  return `gid://shopify/${resource}/${value}`;
}

export const toOrderGid = (id: NumericIdLike) => toGid("Order", id);
export const toCompanyGid = (id: NumericIdLike) => toGid("Company", id);
export const toCompanyLocationGid = (id: NumericIdLike) =>
  toGid("CompanyLocation", id);
export const toVariantGid = (id: NumericIdLike) => toGid("ProductVariant", id);
export const toProductGid = (id: NumericIdLike) => toGid("Product", id);

/**
 * Extract the trailing numeric portion of a Shopify GID.
 *
 * @example fromGid("gid://shopify/Order/123") // => "123"
 */
export function fromGid(gid: string): string {
  const idx = gid.lastIndexOf("/");
  return idx === -1 ? gid : gid.slice(idx + 1);
}
