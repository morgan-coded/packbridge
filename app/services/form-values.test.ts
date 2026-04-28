import { describe, expect, it } from "vitest";
import { optionalFormString, productScopeForRule } from "./form-values.server";

describe("optionalFormString", () => {
  it("normalizes empty option labels from Shopify select elements", () => {
    expect(optionalFormString("")).toBeNull();
    expect(optionalFormString("All companies")).toBeNull();
    expect(optionalFormString("All locations")).toBeNull();
    expect(optionalFormString("None (apply to all products)")).toBeNull();
  });

  it("trims and preserves real identifiers", () => {
    expect(optionalFormString(" gid://shopify/Company/123 ")).toBe(
      "gid://shopify/Company/123",
    );
  });

  it("returns null for non-string form values", () => {
    expect(optionalFormString(null)).toBeNull();
    expect(optionalFormString(new File(["x"], "x.csv"))).toBeNull();
  });
});

describe("productScopeForRule", () => {
  it("stores variant-scoped rules without a product id", () => {
    expect(productScopeForRule("variant-gid", "product-gid")).toBeNull();
  });

  it("preserves product ids for product-scoped rules", () => {
    expect(productScopeForRule(null, "product-gid")).toBe("product-gid");
  });
});
