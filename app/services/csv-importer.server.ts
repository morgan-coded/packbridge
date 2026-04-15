import Papa from "papaparse";
import prisma from "../db.server";

/**
 * CSV rule import — parsing + validation kept strictly separate from
 * execution so the preview step can run without writing any records.
 */

export const REQUIRED_COLUMNS = [
  "company_name",
  "company_location_name",
  "sku",
  "pack_size",
  "downstream_unit_code",
  "enforcement_mode",
] as const;

export type EnforcementMode = "warn" | "hold" | "normalize_only";

export interface ParsedCsvRow {
  row: number; // 1-indexed source row (after header)
  raw: Record<string, string>;
}

export interface ValidatedRow {
  row: number;
  valid: boolean;
  // Resolved (populated only when valid)
  companyId: string | null;
  companyName: string | null;
  companyLocationId: string | null;
  companyLocationName: string | null;
  variantId: string | null;
  productId: string | null;
  sku: string | null;
  packSize?: number;
  downstreamUnitCode: string;
  enforcementMode: EnforcementMode;
  // Raw source values (for preview rendering)
  raw: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  columns: string[];
  missingColumns: string[];
  rows: ValidatedRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  fatalError?: string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function trim(value: string | undefined | null): string {
  return (value ?? "").toString().trim();
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Parse + validate a CSV. Returns a structured preview with per-row status.
 * Does NOT write to the database.
 */
export async function parseAndValidate(
  shopDomain: string,
  csvText: string,
): Promise<ParseResult> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  if (parsed.errors.length > 0) {
    // Papa surfaces malformed CSV here (unterminated quotes, etc.).
    const fatal = parsed.errors.find((e) => e.type === "Quotes");
    if (fatal) {
      return {
        columns: [],
        missingColumns: [],
        rows: [],
        totalRows: 0,
        validCount: 0,
        errorCount: 0,
        fatalError: `CSV parse error on row ${fatal.row}: ${fatal.message}`,
      };
    }
  }

  const columns = parsed.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));

  if (missingColumns.length > 0) {
    return {
      columns,
      missingColumns: [...missingColumns],
      rows: [],
      totalRows: parsed.data.length,
      validCount: 0,
      errorCount: 0,
      fatalError: `Missing required columns: ${missingColumns.join(", ")}`,
    };
  }

  // Preload reference data so validation stays O(rows) instead of O(rows * DB).
  const [companies, locations, variants] = await Promise.all([
    prisma.syncedCompany.findMany({ where: { shopDomain } }),
    prisma.syncedCompanyLocation.findMany({ where: { shopDomain } }),
    prisma.syncedVariant.findMany({ where: { shopDomain } }),
  ]);

  const companyByName = new Map<string, typeof companies[number]>();
  for (const c of companies) companyByName.set(c.name.toLowerCase(), c);

  const locationsByCompany = new Map<
    string,
    Map<string, typeof locations[number]>
  >();
  for (const l of locations) {
    let bucket = locationsByCompany.get(l.companyId);
    if (!bucket) {
      bucket = new Map();
      locationsByCompany.set(l.companyId, bucket);
    }
    bucket.set(l.name.toLowerCase(), l);
  }

  const variantBySku = new Map<string, typeof variants[number]>();
  for (const v of variants) {
    if (v.sku) variantBySku.set(v.sku.toLowerCase(), v);
  }

  // Preload existing rules to detect duplicate scopes.
  const existingRules = await prisma.packRule.findMany({
    where: { shopDomain },
    select: {
      companyId: true,
      companyLocationId: true,
      variantId: true,
      productId: true,
    },
  });
  const scopeKeys = new Set(
    existingRules.map(
      (r) =>
        `${r.companyId ?? ""}|${r.companyLocationId ?? ""}|${r.variantId ?? ""}|${r.productId ?? ""}`,
    ),
  );

  // Track in-file duplicates too.
  const seenInFile = new Set<string>();

  const rows: ValidatedRow[] = parsed.data.map((raw, idx) => {
    const errors: string[] = [];
    const companyName = trim(raw.company_name);
    const locationName = trim(raw.company_location_name);
    const skuInput = trim(raw.sku);
    const packSizeInput = trim(raw.pack_size);
    const unitCodeInput = trim(raw.downstream_unit_code);
    const modeInputRaw = trim(raw.enforcement_mode);
    const modeInput = modeInputRaw === "" ? "warn" : modeInputRaw;

    let companyId: string | null = null;
    let companyLocationId: string | null = null;
    let variantId: string | null = null;
    let productId: string | null = null;
    let sku: string | null = null;

    if (companyName) {
      const company = companyByName.get(companyName.toLowerCase());
      if (!company) {
        errors.push(`Company "${companyName}" not found in synced data`);
      } else {
        companyId = company.id;
      }
    }

    if (locationName) {
      if (!companyId) {
        errors.push("company_location_name requires company_name");
      } else {
        const bucket = locationsByCompany.get(companyId);
        const location = bucket?.get(locationName.toLowerCase());
        if (!location) {
          errors.push(
            `Location "${locationName}" not found for company "${companyName}"`,
          );
        } else {
          companyLocationId = location.id;
        }
      }
    }

    if (skuInput) {
      const variant = variantBySku.get(skuInput.toLowerCase());
      if (!variant) {
        errors.push(`SKU "${skuInput}" not found in synced variants`);
      } else {
        variantId = variant.id;
        productId = variant.productId;
        sku = variant.sku;
      }
    }

    let packSize: number | undefined;
    if (!packSizeInput) {
      errors.push("pack_size is required");
    } else {
      const parsedNum = Number(packSizeInput);
      if (!Number.isInteger(parsedNum) || parsedNum <= 0) {
        errors.push("pack_size must be a positive integer");
      } else {
        packSize = parsedNum;
      }
    }

    if (!unitCodeInput) {
      errors.push("downstream_unit_code is required");
    }

    let enforcementMode: EnforcementMode = "warn";
    if (!["warn", "hold", "normalize_only"].includes(modeInput)) {
      errors.push(
        `enforcement_mode must be one of warn, hold, normalize_only (got "${modeInputRaw}")`,
      );
    } else {
      enforcementMode = modeInput as EnforcementMode;
    }

    const scopeKey = `${companyId ?? ""}|${companyLocationId ?? ""}|${variantId ?? ""}|${productId ?? ""}`;
    if (errors.length === 0) {
      if (scopeKeys.has(scopeKey)) {
        errors.push("A rule already exists for this scope");
      } else if (seenInFile.has(scopeKey)) {
        errors.push("Duplicate scope earlier in this CSV");
      } else {
        seenInFile.add(scopeKey);
      }
    }

    return {
      row: idx + 2, // +1 for header row, +1 for 1-indexed
      valid: errors.length === 0,
      companyId,
      companyName: companyName || null,
      companyLocationId,
      companyLocationName: locationName || null,
      variantId,
      productId,
      sku,
      packSize,
      downstreamUnitCode: unitCodeInput,
      enforcementMode,
      raw,
      errors,
    };
  });

  return {
    columns,
    missingColumns: [],
    rows,
    totalRows: rows.length,
    validCount: rows.filter((r) => r.valid).length,
    errorCount: rows.filter((r) => !r.valid).length,
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ImportExecutionResult {
  jobId: string;
  successCount: number;
  errorCount: number;
}

/**
 * Persist valid rows as PackRules under a RuleImportJob audit record.
 * Invalid rows are skipped but recorded in `errors` for auditability.
 */
export async function executeImport(
  shopDomain: string,
  fileName: string,
  result: ParseResult,
): Promise<ImportExecutionResult> {
  const validRows = result.rows.filter((r) => r.valid);
  const invalidRows = result.rows.filter((r) => !r.valid);

  const job = await prisma.ruleImportJob.create({
    data: {
      shopDomain,
      fileName,
      totalRows: result.totalRows,
      status: "running",
    },
  });

  try {
    if (validRows.length > 0) {
      await prisma.packRule.createMany({
        data: validRows.map((row) => ({
          shopDomain,
          companyId: row.companyId,
          companyLocationId: row.companyLocationId,
          variantId: row.variantId,
          productId: row.productId,
          packSize: row.packSize!,
          downstreamUnitCode: row.downstreamUnitCode,
          enforcementMode: row.enforcementMode,
          active: true,
        })),
      });
    }

    const errorsJson = invalidRows.map((r) => ({
      row: r.row,
      errors: r.errors,
      raw: r.raw,
    }));

    await prisma.ruleImportJob.update({
      where: { id: job.id },
      data: {
        successCount: validRows.length,
        errorCount: invalidRows.length,
        errors: errorsJson.length > 0 ? errorsJson : undefined,
        status: "succeeded",
        completedAt: new Date(),
      },
    });

    return {
      jobId: job.id,
      successCount: validRows.length,
      errorCount: invalidRows.length,
    };
  } catch (error) {
    await prisma.ruleImportJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errors: {
          message: error instanceof Error ? error.message : String(error),
        },
      },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const CSV_TEMPLATE = `company_name,company_location_name,sku,pack_size,downstream_unit_code,enforcement_mode
"Acme Industrial Supply","Main Warehouse","GLOVE-100",50,"CASE","hold"
"Acme Industrial Supply","","GLOVE-200",12,"INNER","warn"
"","","TAPE-500",24,"CASE","normalize_only"
`;
