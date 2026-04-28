const EMPTY_SELECT_VALUES = new Set([
  "",
  "All companies",
  "All locations",
  "None (apply to all products)",
]);

export function optionalFormString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return EMPTY_SELECT_VALUES.has(trimmed) ? null : trimmed;
}

export function productScopeForRule(
  variantId: string | null,
  productId: string | null,
): string | null {
  return variantId ? null : productId;
}
