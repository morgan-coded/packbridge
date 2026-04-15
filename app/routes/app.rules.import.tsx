import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import {
  executeImport,
  parseAndValidate,
  type ParseResult,
} from "../services/csv-importer.server";

interface LoaderData {
  recentJobs: Array<{
    id: string;
    fileName: string;
    totalRows: number;
    successCount: number;
    errorCount: number;
    status: string;
    createdAt: string;
  }>;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);

  const { default: prisma } = await import("../db.server");
  const jobs = await prisma.ruleImportJob.findMany({
    where: { shopDomain: session.shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return {
    recentJobs: jobs.map((j) => ({
      id: j.id,
      fileName: j.fileName,
      totalRows: j.totalRows,
      successCount: j.successCount,
      errorCount: j.errorCount,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    })),
  };
};

type ActionResponse =
  | {
      step: "preview";
      fileName: string;
      csv: string;
      result: ParseResult;
    }
  | {
      step: "done";
      jobId: string;
      successCount: number;
      errorCount: number;
    }
  | {
      step: "error";
      message: string;
    };

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionResponse> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const form = await request.formData();
  const intent = (form.get("intent") as string) || "preview";

  if (intent === "preview") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { step: "error", message: "Please choose a CSV file to upload." };
    }
    const fileName = file.name;
    const csv = await file.text();
    const result = await parseAndValidate(shopDomain, csv);
    return { step: "preview", fileName, csv, result };
  }

  if (intent === "confirm") {
    const fileName = (form.get("fileName") as string) || "rules-import.csv";
    const csv = (form.get("csv") as string) || "";
    if (!csv) {
      return { step: "error", message: "Missing CSV content. Re-upload the file." };
    }
    const result = await parseAndValidate(shopDomain, csv);
    if (result.fatalError) {
      return { step: "error", message: result.fatalError };
    }
    const exec = await executeImport(shopDomain, fileName, result);
    return {
      step: "done",
      jobId: exec.jobId,
      successCount: exec.successCount,
      errorCount: exec.errorCount,
    };
  }

  return { step: "error", message: "Unknown import action." };
};

function rowBadgeTone(
  valid: boolean,
): "success" | "critical" {
  return valid ? "success" : "critical";
}

export default function ImportRules() {
  const { recentJobs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const step = actionData?.step ?? "upload";

  return (
    <s-page heading="Import pack rules from CSV">
      <s-button slot="secondary-actions" href="/app/rules">
        Back to rules
      </s-button>
      <s-button
        slot="secondary-actions"
        href="/app/rules/template.csv"
        download="packbridge-rules-template.csv"
      >
        Download template
      </s-button>

      {step === "upload" && (
        <s-section heading="Step 1 — Upload CSV">
          <s-paragraph>
            Upload a CSV with columns: <code>company_name</code>,{" "}
            <code>company_location_name</code>, <code>sku</code>,{" "}
            <code>pack_size</code>, <code>downstream_unit_code</code>,{" "}
            <code>enforcement_mode</code>. Download the template above to see
            the expected shape.
          </s-paragraph>
          <Form method="post" encType="multipart/form-data">
            <input type="hidden" name="intent" value="preview" />
            <s-stack direction="block" gap="base">
              <s-drop-zone
                name="file"
                label="CSV file"
                accept=".csv,text/csv"
              />
              <s-button type="submit" variant="primary">
                Preview rules
              </s-button>
            </s-stack>
          </Form>
        </s-section>
      )}

      {step === "preview" && actionData?.step === "preview" && (
        <>
          <s-section
            heading={`Step 2 — Preview (${actionData.result.validCount} valid, ${actionData.result.errorCount} with errors)`}
          >
            {actionData.result.fatalError && (
              <s-banner tone="critical" heading="CSV could not be imported">
                <s-paragraph>{actionData.result.fatalError}</s-paragraph>
              </s-banner>
            )}

            {!actionData.result.fatalError && (
              <>
                <s-paragraph>
                  Reviewing file <strong>{actionData.fileName}</strong> —{" "}
                  {actionData.result.totalRows} row
                  {actionData.result.totalRows === 1 ? "" : "s"}.
                </s-paragraph>

                <s-table>
                  <s-table-header-row>
                    <s-table-header>Row</s-table-header>
                    <s-table-header>Company</s-table-header>
                    <s-table-header>Location</s-table-header>
                    <s-table-header>SKU</s-table-header>
                    <s-table-header format="numeric">Pack size</s-table-header>
                    <s-table-header>Unit code</s-table-header>
                    <s-table-header>Mode</s-table-header>
                    <s-table-header>Status</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {actionData.result.rows.map((row) => (
                      <s-table-row key={row.row}>
                        <s-table-cell>{row.row}</s-table-cell>
                        <s-table-cell>
                          {row.companyName ?? "All companies"}
                        </s-table-cell>
                        <s-table-cell>
                          {row.companyLocationName ?? "—"}
                        </s-table-cell>
                        <s-table-cell>
                          {row.sku ?? row.raw.sku ?? "All products"}
                        </s-table-cell>
                        <s-table-cell>
                          {row.packSize ?? row.raw.pack_size ?? "—"}
                        </s-table-cell>
                        <s-table-cell>{row.downstreamUnitCode}</s-table-cell>
                        <s-table-cell>{row.enforcementMode}</s-table-cell>
                        <s-table-cell>
                          <s-stack direction="block" gap="small">
                            <s-badge tone={rowBadgeTone(row.valid)}>
                              {row.valid ? "Ready" : "Error"}
                            </s-badge>
                            {row.errors.map((err, i) => (
                              <s-text key={i} tone="critical">
                                {err}
                              </s-text>
                            ))}
                          </s-stack>
                        </s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              </>
            )}
          </s-section>

          {!actionData.result.fatalError && actionData.result.validCount > 0 && (
            <s-section heading="Step 3 — Confirm import">
              <s-paragraph>
                Importing will create {actionData.result.validCount} pack rule
                {actionData.result.validCount === 1 ? "" : "s"}. Invalid rows
                are skipped and recorded in the import job log.
              </s-paragraph>
              <Form method="post">
                <input type="hidden" name="intent" value="confirm" />
                <input
                  type="hidden"
                  name="fileName"
                  value={actionData.fileName}
                />
                <input type="hidden" name="csv" value={actionData.csv} />
                <s-stack direction="inline" gap="base">
                  <s-button type="submit" variant="primary">
                    Import {actionData.result.validCount} valid rule
                    {actionData.result.validCount === 1 ? "" : "s"}
                  </s-button>
                  <s-button href="/app/rules/import" variant="tertiary">
                    Cancel
                  </s-button>
                </s-stack>
              </Form>
            </s-section>
          )}
        </>
      )}

      {step === "done" && actionData?.step === "done" && (
        <s-section heading="Import complete">
          <s-banner tone="success" heading="Import finished">
            <s-paragraph>
              Imported {actionData.successCount} rule
              {actionData.successCount === 1 ? "" : "s"}. Skipped{" "}
              {actionData.errorCount} row
              {actionData.errorCount === 1 ? "" : "s"} due to errors.
            </s-paragraph>
          </s-banner>
          <s-stack direction="inline" gap="base">
            <s-button href="/app/rules" variant="primary">
              View rules
            </s-button>
            {actionData.errorCount > 0 && (
              <s-button
                href={`/app/rules/import/${actionData.jobId}/errors.json`}
                variant="tertiary"
              >
                Download error log
              </s-button>
            )}
          </s-stack>
        </s-section>
      )}

      {actionData?.step === "error" && (
        <s-section heading="Import error">
          <s-banner tone="critical" heading="Something went wrong">
            <s-paragraph>{actionData.message}</s-paragraph>
          </s-banner>
          <s-button href="/app/rules/import">Start over</s-button>
        </s-section>
      )}

      <s-section heading="Recent import jobs">
        {recentJobs.length === 0 ? (
          <s-paragraph>No imports yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>When</s-table-header>
              <s-table-header>File</s-table-header>
              <s-table-header format="numeric">Rows</s-table-header>
              <s-table-header format="numeric">Imported</s-table-header>
              <s-table-header format="numeric">Errors</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {recentJobs.map((j) => (
                <s-table-row key={j.id}>
                  <s-table-cell>
                    {new Date(j.createdAt).toLocaleString()}
                  </s-table-cell>
                  <s-table-cell>{j.fileName}</s-table-cell>
                  <s-table-cell>{j.totalRows}</s-table-cell>
                  <s-table-cell>{j.successCount}</s-table-cell>
                  <s-table-cell>{j.errorCount}</s-table-cell>
                  <s-table-cell>{j.status}</s-table-cell>
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
